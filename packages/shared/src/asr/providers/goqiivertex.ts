import { ASRProvider } from "../ASRProvider.js";
import { ASRErrorCode, ASRPermanentError, ASRTransientError } from "../errors.js";
import type { SpeakerLabel, TranscribeOptions, TranscriptResult, Turn } from "../types.js";

/**
 * GOQii Vertex provider — transcription via GOQii's internal Vertex AI (Gemini)
 * endpoint.
 *
 * The endpoint takes a PUBLIC audio URL plus a free-text `prompt` and returns a
 * single plain-text string (`data.response`) — it has no native diarization,
 * timestamps, or confidence. We steer it with the prompt to emit speaker-labelled
 * lines ("Doctor:" / "Patient:") and parse those into turns; if the model returns
 * unlabelled text we fall back to a single "unknown" turn covering the transcript.
 *
 * Endpoint: POST https://apiv6.goqii.com/vertex/recording
 * Headers:  clientId, clientSecret
 * Body:     { file: <public audio url>, prompt: <instruction> }
 * Env:      GOQII_VERTEX_CLIENT_ID, GOQII_VERTEX_CLIENT_SECRET, GOQII_VERTEX_URL (optional)
 *
 * NOTE: the endpoint is slow (~20s) and its gateway returns 502 at ~30s. Those
 * 5xx/timeout cases are surfaced as ASRTransientError so the base-class retry
 * (2 retries, 5s/10s backoff) can recover.
 */
const DEFAULT_URL = "https://apiv6.goqii.com/vertex/recording";

/** No per-turn confidence from this API; use a fixed estimate. */
const ESTIMATED_CONFIDENCE = 0.7;

export class GoqiiVertexASRProvider extends ASRProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly url: string;

  constructor(
    clientId = process.env.GOQII_VERTEX_CLIENT_ID ?? "",
    clientSecret = process.env.GOQII_VERTEX_CLIENT_SECRET ?? "",
    url = process.env.GOQII_VERTEX_URL ?? DEFAULT_URL,
  ) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.url = url;
  }

  getName(): string {
    return "GOQii-Vertex";
  }

  async getHealthCheck(): Promise<boolean> {
    return !!this.clientId && !!this.clientSecret;
  }

  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    if (!this.clientId || !this.clientSecret) {
      throw new ASRPermanentError(
        "GOQII_VERTEX_CLIENT_ID / GOQII_VERTEX_CLIENT_SECRET are not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }

    const prompt = buildPrompt(options);

    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: {
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: audioUrl, prompt }),
        // Generous client timeout; the upstream gateway itself caps ~30s.
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      // Network error / abort → transient (base class retries).
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
        `Invalid audio / request (${res.status})`,
        ASRErrorCode.INVALID_AUDIO,
        this.getName(),
      );
    }
    if (res.status === 429) {
      throw new ASRTransientError("Rate limited", ASRErrorCode.RATE_LIMIT, this.getName());
    }
    if (res.status >= 500) {
      // Includes the ~30s gateway 502 — retriable.
      throw new ASRTransientError(`Upstream ${res.status}`, ASRErrorCode.UNKNOWN, this.getName());
    }
    if (res.status >= 400) {
      // Any other 4xx (e.g. 404 from a misconfigured GOQII_VERTEX_URL) is a
      // client-side/config problem that retrying will not fix.
      throw new ASRPermanentError(
        `Unexpected ${res.status}`,
        ASRErrorCode.INVALID_AUDIO,
        this.getName(),
      );
    }
    if (!res.ok) {
      throw new ASRTransientError(`Unexpected ${res.status}`, ASRErrorCode.UNKNOWN, this.getName());
    }

    let raw: GoqiiVertexResponse;
    try {
      raw = (await res.json()) as GoqiiVertexResponse;
    } catch (err) {
      throw new ASRTransientError(
        `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }

    const transcript = raw?.data?.response;
    if (typeof transcript !== "string" || transcript.trim() === "") {
      throw new ASRTransientError(
        `Empty or missing transcript (message: ${raw?.message ?? "n/a"})`,
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }

    const turns = parseTurns(transcript);
    const overallConfidence = ESTIMATED_CONFIDENCE;

    return {
      turns,
      languageDetected: options.language === "auto" ? "auto" : options.language,
      overallConfidence,
      durationMs: 0, // endpoint does not report audio length
      processingTimeMs: 0, // stamped by base class
      providerName: this.getName(),
      rawProviderResponse: raw,
    };
  }
}

/**
 * Build the transcription instruction. We ask for speaker-labelled, verbatim
 * output in the requested script so the plain-text response can be parsed into
 * doctor/patient turns.
 */
function buildPrompt(options: TranscribeOptions): string {
  const script =
    options.scriptOutput === "devanagari"
      ? "Use Devanagari script for Hindi."
      : "Transliterate any Hindi/Hinglish speech into Roman (Latin) script.";

  return [
    "Transcribe this doctor–patient medical consultation verbatim.",
    "Write each speaker's turn on its own line, prefixed with exactly 'Doctor:' or 'Patient:' (use 'Other:' for anyone else).",
    script,
    "Do not summarise, translate, or add commentary. Output only the transcript lines.",
  ].join(" ");
}

/**
 * Parse the model's plain-text output into turns. Lines prefixed with a speaker
 * label become individual turns; if no labelled lines are found the whole text
 * becomes one "unknown" turn.
 */
function parseTurns(text: string): Turn[] {
  const lineRe = /^\s*(doctor|patient|other)\s*:\s*(.+)$/i;
  const turns: Turn[] = [];

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const speaker = m[1]!.toLowerCase() as Exclude<SpeakerLabel, "unknown">;
    const content = m[2]!.trim();
    if (content === "") continue;
    turns.push({
      speaker,
      startMs: 0,
      endMs: 0,
      text: content,
      confidence: ESTIMATED_CONFIDENCE,
    });
  }

  if (turns.length === 0) {
    return [
      {
        speaker: "unknown",
        startMs: 0,
        endMs: 0,
        text: text.trim(),
        confidence: ESTIMATED_CONFIDENCE,
      },
    ];
  }

  return turns;
}

interface GoqiiVertexResponse {
  status?: number;
  message?: string;
  data?: { response?: string };
}
