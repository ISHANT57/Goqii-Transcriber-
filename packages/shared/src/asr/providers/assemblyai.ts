import { ASRProvider } from "../ASRProvider.js";
import { ASRErrorCode, ASRPermanentError, ASRTransientError } from "../errors.js";
import type { SpeakerLabel, TranscribeOptions, TranscriptResult, Turn } from "../types.js";

/**
 * AssemblyAI provider (PRD §6.2.5).
 *
 * Async transcription API:
 *   POST /transcript        → submit job ({ audio_url, ... }) → { id, status }
 *   GET  /transcript/{id}   → poll until status is "completed" | "error"
 *
 * AssemblyAI accepts a remote HTTPS audio URL directly (our short-lived signed
 * Supabase URL), so no byte upload is required.
 *
 * Env: ASSEMBLYAI_API_KEY.
 *
 * NOTE: AssemblyAI has no Roman-transliteration output option (unlike
 * Sarvam) — `options.scriptOutput` is NOT honored. Hindi speech comes back in
 * whatever script AssemblyAI natively emits, even though the app's LLM
 * note-generation prompts assume Roman-script input.
 */
const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";
const POLL_INTERVAL_MS = 3_000;
const OVERALL_DEADLINE_MS = 300_000; // ~5 min cap on the async job

export class AssemblyAIASRProvider extends ASRProvider {
  private readonly apiKey: string;

  constructor(apiKey = process.env.ASSEMBLYAI_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  getName(): string {
    return "AssemblyAI";
  }

  async getHealthCheck(): Promise<boolean> {
    // AssemblyAI has no cheap unauthenticated ping; presence of a key is the
    // cheapest reachability signal we can give within the 10 s startup budget.
    return !!this.apiKey;
  }

  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    if (!this.apiKey) {
      throw new ASRPermanentError(
        "ASSEMBLYAI_API_KEY is not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }

    const isAuto = options.language === "auto";
    const submitBody: Record<string, unknown> = {
      audio_url: audioUrl,
      speaker_labels: true,
      speakers_expected: options.speakerCount,
      language_detection: isAuto,
    };
    if (!isAuto) {
      // Map our supported codes to AssemblyAI language_code values.
      submitBody.language_code = options.language === "hi" ? "hi" : "en";
    }

    // 1) Submit the transcription job.
    const submit = await this.request("/transcript", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submitBody),
    });
    const submitJson = (await submit.json()) as AssemblyAITranscript;
    const id = submitJson.id;
    if (!id) {
      throw new ASRTransientError(
        "AssemblyAI did not return a transcript id",
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }

    // 2) Poll until completed or error, bounded by an overall deadline.
    const deadline = Date.now() + OVERALL_DEADLINE_MS;
    let result: AssemblyAITranscript = submitJson;
    while (result.status !== "completed" && result.status !== "error") {
      if (Date.now() > deadline) {
        throw new ASRTransientError(
          "AssemblyAI polling exceeded deadline",
          ASRErrorCode.TIMEOUT,
          this.getName(),
        );
      }
      await sleep(POLL_INTERVAL_MS);
      const poll = await this.request(`/transcript/${id}`, { method: "GET" });
      result = (await poll.json()) as AssemblyAITranscript;
    }

    if (result.status === "error") {
      const msg = result.error ?? "AssemblyAI transcription failed";
      // Audio-related failures are permanent (bad/unreadable input).
      if (/audio|download|decode|format|duration|empty/i.test(msg)) {
        throw new ASRPermanentError(msg, ASRErrorCode.INVALID_AUDIO, this.getName());
      }
      throw new ASRTransientError(msg, ASRErrorCode.UNKNOWN, this.getName());
    }

    // 3) Normalise utterances → turns.
    const turns: Turn[] = (result.utterances ?? []).map((u) => ({
      speaker: normaliseSpeaker(u.speaker),
      startMs: Math.round(u.start),
      endMs: Math.round(u.end),
      text: u.text,
      confidence: u.confidence ?? 0.7,
    }));

    const durationMs = Math.round((result.audio_duration ?? 0) * 1000);
    const overallConfidence =
      result.confidence ??
      (turns.length
        ? turns.reduce((a, t) => a + t.confidence * (t.endMs - t.startMs), 0) /
          Math.max(1, turns.reduce((a, t) => a + (t.endMs - t.startMs), 0))
        : 0);

    return {
      turns,
      languageDetected: result.language_code ?? (isAuto ? "auto" : options.language),
      overallConfidence,
      durationMs,
      processingTimeMs: 0, // stamped by base class
      providerName: this.getName(),
      rawProviderResponse: result,
    };
  }

  /** Authenticated fetch with AssemblyAI status-code → error-type mapping. */
  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${ASSEMBLYAI_BASE}${path}`, {
        ...init,
        headers: { authorization: this.apiKey, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(30_000),
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
    if (res.status === 429) {
      throw new ASRTransientError("Rate limited", ASRErrorCode.RATE_LIMIT, this.getName());
    }
    if (res.status >= 500) {
      throw new ASRTransientError(`Upstream ${res.status}`, ASRErrorCode.UNKNOWN, this.getName());
    }
    if (!res.ok) {
      // 4xx on submit usually means a bad request / unsupported audio reference.
      throw new ASRPermanentError(`Request failed (${res.status})`, ASRErrorCode.INVALID_AUDIO, this.getName());
    }
    return res;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** AssemblyAI returns speaker tags "A", "B", "C", … → role labels. */
function normaliseSpeaker(s: string | undefined): SpeakerLabel {
  switch ((s ?? "").toUpperCase()) {
    case "A":
      return "doctor";
    case "B":
      return "patient";
    case "C":
      return "other";
    default:
      return "unknown";
  }
}

interface AssemblyAITranscript {
  id?: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  language_code?: string;
  audio_duration?: number; // seconds
  confidence?: number; // 0–1 document-level
  utterances?: Array<{
    speaker?: string;
    start: number; // ms
    end: number; // ms
    text: string;
    confidence?: number;
  }>;
}
