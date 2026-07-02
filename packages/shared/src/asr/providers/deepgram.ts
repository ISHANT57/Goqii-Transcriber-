import { ASRProvider } from "../ASRProvider.js";
import { ASRErrorCode, ASRPermanentError, ASRTransientError } from "../errors.js";
import type { SpeakerLabel, TranscribeOptions, TranscriptResult, Turn } from "../types.js";

/**
 * Deepgram Nova-2 provider (PRD §6.2.5).
 *
 * Synchronous pre-recorded API:
 *   POST /v1/listen?model=nova-2&diarize=true&punctuate=true&utterances=true&detect_language=true
 *   Body: { url: <remote audio url> }  (Deepgram fetches the signed Supabase URL).
 *
 * Env: DEEPGRAM_API_KEY.
 *
 * NOTE: Deepgram has no Roman-transliteration output option (unlike Sarvam) —
 * `options.scriptOutput` is NOT honored. Hindi speech comes back in whatever
 * script Deepgram's Nova-2 model natively emits (typically Devanagari), even
 * though the app's LLM note-generation prompts assume Roman-script input.
 */
const DEEPGRAM_LISTEN = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_PROJECTS = "https://api.deepgram.com/v1/projects";

export class DeepgramASRProvider extends ASRProvider {
  private readonly apiKey: string;

  constructor(apiKey = process.env.DEEPGRAM_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  getName(): string {
    return "Deepgram";
  }

  async getHealthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(DEEPGRAM_PROJECTS, {
        method: "GET",
        headers: { Authorization: `Token ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      // A network failure here (DNS, timeout, firewall) means Deepgram is not
      // actually reachable — `this.apiKey` is already known truthy at this
      // point, so returning it unconditionally always reported "healthy"
      // regardless of connectivity, masking a real outage until the first
      // production transcription job failed.
      return false;
    }
  }

  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    if (!this.apiKey) {
      throw new ASRPermanentError(
        "DEEPGRAM_API_KEY is not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }

    const params = new URLSearchParams({
      model: "nova-2",
      diarize: "true",
      punctuate: "true",
      utterances: "true",
    });
    if (options.language === "auto") {
      params.set("detect_language", "true");
    } else {
      // Deepgram language codes: "hi" for Hindi, "en-IN" for Indian English.
      params.set("language", options.language === "hi" ? "hi" : "en-IN");
    }

    let res: Response;
    try {
      res = await fetch(`${DEEPGRAM_LISTEN}?${params.toString()}`, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: audioUrl }),
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
    if (res.status === 400 || res.status === 415) {
      throw new ASRPermanentError(`Invalid audio (${res.status})`, ASRErrorCode.INVALID_AUDIO, this.getName());
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

    const raw = (await res.json()) as DeepgramResponse;

    const channel = raw.results?.channels?.[0];
    const turns: Turn[] = (raw.results?.utterances ?? []).map((u) => ({
      speaker: normaliseSpeaker(u.speaker),
      startMs: Math.round((u.start ?? 0) * 1000),
      endMs: Math.round((u.end ?? 0) * 1000),
      text: u.transcript ?? "",
      confidence: u.confidence ?? 0.7,
    }));

    const durationMs = Math.round((raw.metadata?.duration ?? 0) * 1000);
    const overallConfidence =
      channel?.alternatives?.[0]?.confidence ??
      (turns.length
        ? turns.reduce((a, t) => a + t.confidence * (t.endMs - t.startMs), 0) /
          Math.max(1, turns.reduce((a, t) => a + (t.endMs - t.startMs), 0))
        : 0);

    return {
      turns,
      languageDetected:
        channel?.detected_language ?? (options.language === "auto" ? "auto" : options.language),
      overallConfidence,
      durationMs,
      processingTimeMs: 0, // stamped by base class
      providerName: this.getName(),
      rawProviderResponse: raw,
    };
  }
}

/** Deepgram diarisation returns integer speaker ids (0, 1, 2, …) → role labels. */
function normaliseSpeaker(s: number | undefined): SpeakerLabel {
  switch (s) {
    case 0:
      return "doctor";
    case 1:
      return "patient";
    case 2:
      return "other";
    default:
      return "unknown";
  }
}

interface DeepgramResponse {
  metadata?: { duration?: number };
  results?: {
    channels?: Array<{
      detected_language?: string;
      alternatives?: Array<{ confidence?: number }>;
    }>;
    utterances?: Array<{
      speaker?: number;
      start?: number; // seconds
      end?: number; // seconds
      transcript?: string;
      confidence?: number;
    }>;
  };
}
