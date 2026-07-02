import { ASRProvider } from "../ASRProvider.js";
import { ASRErrorCode, ASRPermanentError, ASRTransientError } from "../errors.js";
import type { SpeakerLabel, TranscribeOptions, TranscriptResult, Turn } from "../types.js";

/**
 * Self-hosted faster-whisper fallback (PRD §6.2.5 / §8.3.2).
 *
 * Wraps a FastAPI service deployed on a Railway GPU instance running the
 * `large-v3` model with pyannote.audio diarisation. DPA-free because audio
 * never leaves Gooqi-controlled infrastructure.
 *
 * The remote service is expected to expose:
 *   GET  /health      → 200 when the model is loaded
 *   POST /transcribe  → { turns, language_detected, duration_ms, ... }
 *
 * Env: FASTER_WHISPER_URL (base URL of the Railway service).
 */
export class FasterWhisperASRProvider extends ASRProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.FASTER_WHISPER_URL ?? "") {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  getName(): string {
    return "FasterWhisper-Railway";
  }

  async getHealthCheck(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    if (!this.baseUrl) {
      throw new ASRPermanentError(
        "FASTER_WHISPER_URL is not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/transcribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audio_url: audioUrl,
          language: options.language,
          max_speakers: options.maxSpeakers ?? 3,
          script_output: options.scriptOutput,
          noise_reduction: options.noiseReduction ?? true,
        }),
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
      throw new ASRPermanentError(
        `Auth failure (${res.status})`,
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }
    if (res.status === 400 || res.status === 415 || res.status === 422) {
      throw new ASRPermanentError(
        `Invalid audio (${res.status})`,
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
      throw new ASRTransientError(`Unexpected ${res.status}`, ASRErrorCode.UNKNOWN, this.getName());
    }

    const raw = (await res.json()) as FasterWhisperResponse;

    const turns: Turn[] = (raw.turns ?? []).map((t) => ({
      speaker: normaliseSpeaker(t.speaker),
      startMs: Math.round(t.start_ms),
      endMs: Math.round(t.end_ms),
      text: t.text,
      confidence: t.confidence ?? 0.7,
    }));

    const durationMs = raw.duration_ms ?? turns.at(-1)?.endMs ?? 0;
    const overallConfidence =
      raw.overall_confidence ??
      (turns.length
        ? turns.reduce((a, t) => a + t.confidence * (t.endMs - t.startMs), 0) /
          Math.max(1, turns.reduce((a, t) => a + (t.endMs - t.startMs), 0))
        : 0);

    return {
      turns,
      languageDetected: raw.language_detected ?? "hi-Latn",
      overallConfidence,
      durationMs,
      processingTimeMs: 0, // stamped by base class
      providerName: this.getName(),
      rawProviderResponse: raw,
    };
  }
}

function normaliseSpeaker(s: string | undefined): SpeakerLabel {
  switch ((s ?? "").toLowerCase()) {
    case "doctor":
    case "speaker_0":
    case "spk_0":
      return "doctor";
    case "patient":
    case "speaker_1":
    case "spk_1":
      return "patient";
    case "other":
    case "speaker_2":
    case "spk_2":
      return "other";
    default:
      return "unknown";
  }
}

interface FasterWhisperResponse {
  turns?: Array<{
    speaker?: string;
    start_ms: number;
    end_ms: number;
    text: string;
    confidence?: number;
  }>;
  language_detected?: string;
  overall_confidence?: number;
  duration_ms?: number;
}
