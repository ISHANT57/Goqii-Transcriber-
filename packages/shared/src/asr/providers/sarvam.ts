import { ASRProvider } from "../ASRProvider.js";
import { ASRErrorCode, ASRPermanentError, ASRTransientError } from "../errors.js";
import type { TranscribeOptions, TranscriptResult } from "../types.js";
import {
  aggregateTurns,
  sarvamResponseToTurns,
  toSarvamLanguageCode,
  type SarvamResponse,
} from "./sarvamShared.js";

/**
 * Sarvam AI provider — Saarika speech-to-text, real-time endpoint (PRD §6.2.5).
 *
 * Preferred for DPDP compliance and strong Hindi/Hinglish support, with native
 * Roman-script transliteration.
 *
 * NOTE: Sarvam's public STT endpoint expects a MULTIPART file upload, not a
 * remote URL. We therefore fetch the signed Supabase audio bytes first and
 * send them as the multipart `file` field.
 *
 * `with_diarization` is intentionally NOT sent: the real-time /speech-to-text
 * endpoint rejects it with 400 ("Diarization is not supported in the
 * real-time API. Please use the batch API for diarization.") — confirmed
 * against the live API. For real speaker separation use the `sarvam_batch`
 * provider (`sarvamBatch.ts`) instead; this provider always returns a single
 * "unknown"-speaker turn (see sarvamResponseToTurns' fallback).
 *
 * Endpoint: POST https://api.sarvam.ai/speech-to-text
 * Header:   api-subscription-key: <key>
 * Env:      SARVAM_API_KEY.
 */
const SARVAM_STT = "https://api.sarvam.ai/speech-to-text";

export class SarvamASRProvider extends ASRProvider {
  private readonly apiKey: string;

  constructor(apiKey = process.env.SARVAM_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  getName(): string {
    return "Sarvam";
  }

  async getHealthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }

  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    if (!this.apiKey) {
      throw new ASRPermanentError(
        "SARVAM_API_KEY is not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }

    // 1) Fetch the signed audio bytes (Sarvam wants a multipart file upload).
    let audioBuffer: ArrayBuffer;
    try {
      const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
      if (!audioRes.ok) {
        throw new ASRPermanentError(
          `Failed to fetch audio (${audioRes.status})`,
          ASRErrorCode.INVALID_AUDIO,
          this.getName(),
        );
      }
      audioBuffer = await audioRes.arrayBuffer();
    } catch (err) {
      if (err instanceof ASRPermanentError) throw err;
      throw new ASRTransientError(
        err instanceof Error ? err.message : String(err),
        ASRErrorCode.TIMEOUT,
        this.getName(),
      );
    }

    // 2) Build the multipart request.
    const languageCode = toSarvamLanguageCode(options.language);

    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: "audio/webm" }), "audio.webm");
    form.append("model", "saarika:v2.5");
    form.append("language_code", languageCode);
    form.append("with_timestamps", "true");
    // "roman" script output requested via transliteration where supported.
    if (options.scriptOutput === "roman") {
      form.append("script", "roman");
    }

    let res: Response;
    try {
      res = await fetch(SARVAM_STT, {
        method: "POST",
        headers: { "api-subscription-key": this.apiKey },
        body: form,
        signal: AbortSignal.timeout(300_000), // up to 5 min for long audio
      });
    } catch (err) {
      throw new ASRTransientError(
        err instanceof Error ? err.message : String(err),
        ASRErrorCode.TIMEOUT,
        this.getName(),
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new ASRPermanentError(`Auth failure (${res.status})`, ASRErrorCode.AUTH_FAILURE, this.getName());
    }
    if (res.status === 400 || res.status === 415 || res.status === 422) {
      const body = await res.text().catch(() => "");
      throw new ASRPermanentError(
        `Invalid audio (${res.status}): ${body.slice(0, 500)}`,
        ASRErrorCode.INVALID_AUDIO,
        this.getName(),
      );
    }
    if (res.status === 429) {
      throw new ASRTransientError("Rate limited", ASRErrorCode.RATE_LIMIT, this.getName());
    }
    if (res.status >= 500) {
      throw new ASRTransientError(`Upstream ${res.status}`, ASRErrorCode.UNKNOWN, this.getName());
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ASRTransientError(`Unexpected ${res.status}: ${body.slice(0, 500)}`, ASRErrorCode.UNKNOWN, this.getName());
    }

    const raw = (await res.json()) as SarvamResponse;
    const turns = sarvamResponseToTurns(raw);
    const { durationMs, overallConfidence } = aggregateTurns(turns);

    return {
      turns,
      languageDetected: raw.language_code ?? (languageCode === "unknown" ? "auto" : languageCode),
      overallConfidence,
      durationMs,
      processingTimeMs: 0, // stamped by base class
      providerName: this.getName(),
      rawProviderResponse: raw,
    };
  }
}
