import { ASRProvider } from "../ASRProvider.js";
import { ASRErrorCode, ASRPermanentError, ASRTransientError } from "../errors.js";
import type { SpeakerLabel, TranscribeOptions, TranscriptResult, Turn } from "../types.js";

/**
 * Google Cloud Speech-to-Text v2 (Chirp) provider (PRD §6.2.5).
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS (service-account JSON path) is picked up
 * automatically by the SDK. The project id is taken from
 * GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT.
 *
 * Audio handling: our audio lives in Supabase Storage, not GCS. Google v2
 * `batchRecognize` accepts a GCS URI but `recognize` (sync) accepts inline
 * base64 `content`. For the pilot we fetch the signed URL bytes and use the
 * inline `recognize` path, which supports clips up to ~1 minute.
 *
 * TODO: For audio longer than ~1 minute, upload the bytes to a temporary GCS
 * bucket and switch to `batchRecognize` with a `gcsUri`, then poll the LRO.
 *
 * NOTE: Google Speech-to-Text has no Roman-transliteration output option
 * (unlike Sarvam) — `options.scriptOutput` is NOT honored. Hindi speech comes
 * back in whatever script the Chirp model natively emits (Devanagari), even
 * though the app's LLM note-generation prompts assume Roman-script input.
 */

// Lazy dynamic import so the heavy SDK is only loaded when this provider runs,
// and so the package still type-checks even before `npm install` adds the dep.
type SpeechClientType = import("@google-cloud/speech").v2.SpeechClient;

const DEFAULT_LOCATION = "global";

export class GoogleChirpASRProvider extends ASRProvider {
  private clientPromise?: Promise<SpeechClientType>;

  getName(): string {
    return "GoogleChirp";
  }

  async getHealthCheck(): Promise<boolean> {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) return false;
    try {
      const client = await this.getClient();
      // Constructing SpeechClient only parses the credentials file — it does
      // not contact Google, so a bad/expired service account still "succeeds"
      // here and only surfaces on the first real recognize() call. Fetching
      // an access token is the standard cheap way to actually authenticate
      // against the credential without making a billable Speech API call.
      await client.auth.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  private async getClient(): Promise<SpeechClientType> {
    if (!this.clientPromise) {
      this.clientPromise = import("@google-cloud/speech").then(
        (mod) => new mod.v2.SpeechClient(),
      );
    }
    return this.clientPromise;
  }

  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new ASRPermanentError(
        "GOOGLE_APPLICATION_CREDENTIALS is not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "";
    if (!projectId) {
      throw new ASRPermanentError(
        "GOOGLE_CLOUD_PROJECT is not configured",
        ASRErrorCode.AUTH_FAILURE,
        this.getName(),
      );
    }

    // 1) Fetch the signed audio bytes for inline recognition.
    let content: Buffer;
    try {
      const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
      if (!audioRes.ok) {
        throw new ASRPermanentError(
          `Failed to fetch audio (${audioRes.status})`,
          ASRErrorCode.INVALID_AUDIO,
          this.getName(),
        );
      }
      content = Buffer.from(await audioRes.arrayBuffer());
    } catch (err) {
      if (err instanceof ASRPermanentError) throw err;
      throw new ASRTransientError(
        err instanceof Error ? err.message : String(err),
        ASRErrorCode.TIMEOUT,
        this.getName(),
      );
    }

    const client = await this.getClient();
    const maxSpeakers = options.maxSpeakers ?? 3;
    const languageCodes =
      options.language === "auto"
        ? ["auto"]
        : options.language === "hi"
          ? ["hi-IN"]
          : ["en-IN"];

    // 2) Inline recognize with the Chirp model + speaker diarisation.
    let response: GoogleRecognizeResponse;
    try {
      const [res] = await client.recognize({
        recognizer: `projects/${projectId}/locations/${DEFAULT_LOCATION}/recognizers/_`,
        config: {
          model: "chirp",
          languageCodes,
          autoDecodingConfig: {},
          features: {
            enableWordTimeOffsets: true,
            enableWordConfidence: true,
            diarizationConfig: {
              minSpeakerCount: 1,
              maxSpeakerCount: maxSpeakers,
            },
          },
        },
        content,
      });
      response = res as GoogleRecognizeResponse;
    } catch (err) {
      throw mapGoogleError(err, this.getName());
    }

    // 3) Group words by speaker tag into turns.
    const turns: Turn[] = [];
    let languageDetected = options.language === "auto" ? "auto" : languageCodes[0];
    let docConfidenceSum = 0;
    let docConfidenceCount = 0;

    for (const result of response.results ?? []) {
      if (result.languageCode) languageDetected = result.languageCode;
      const alt = result.alternatives?.[0];
      if (!alt) continue;
      if (typeof alt.confidence === "number") {
        docConfidenceSum += alt.confidence;
        docConfidenceCount += 1;
      }

      const words = alt.words ?? [];
      if (words.length === 0) {
        // No word-level diarisation; emit the alternative as one unknown turn.
        if (alt.transcript) {
          turns.push({
            speaker: "unknown",
            startMs: 0,
            endMs: 0,
            text: alt.transcript,
            confidence: alt.confidence ?? 0.7,
          });
        }
        continue;
      }

      // Accumulate consecutive words sharing the same speaker label into a turn.
      let current: {
        speaker: number | undefined;
        words: string[];
        startMs: number;
        endMs: number;
        confSum: number;
        confCount: number;
      } | null = null;

      const flush = () => {
        if (!current) return;
        turns.push({
          speaker: normaliseSpeaker(current.speaker),
          startMs: current.startMs,
          endMs: current.endMs,
          text: current.words.join(" "),
          confidence: current.confCount ? current.confSum / current.confCount : (alt.confidence ?? 0.7),
        });
        current = null;
      };

      for (const w of words) {
        const speaker = w.speakerLabel != null ? Number(w.speakerLabel) : w.speakerTag;
        const startMs = durationToMs(w.startOffset);
        const endMs = durationToMs(w.endOffset);
        const text = w.word ?? "";
        if (!current || current.speaker !== speaker) {
          flush();
          current = {
            speaker,
            words: [text],
            startMs,
            endMs,
            confSum: w.confidence ?? 0,
            confCount: typeof w.confidence === "number" ? 1 : 0,
          };
        } else {
          current.words.push(text);
          current.endMs = endMs;
          if (typeof w.confidence === "number") {
            current.confSum += w.confidence;
            current.confCount += 1;
          }
        }
      }
      flush();
    }

    const durationMs = turns.at(-1)?.endMs ?? 0;
    const overallConfidence = docConfidenceCount
      ? docConfidenceSum / docConfidenceCount
      : turns.length
        ? turns.reduce((a, t) => a + t.confidence * Math.max(1, t.endMs - t.startMs), 0) /
          turns.reduce((a, t) => a + Math.max(1, t.endMs - t.startMs), 0)
        : 0;

    return {
      turns,
      languageDetected: languageDetected ?? "auto",
      overallConfidence,
      durationMs,
      processingTimeMs: 0, // stamped by base class
      providerName: this.getName(),
      rawProviderResponse: response,
    };
  }
}

/** Convert a google.protobuf.Duration ({ seconds, nanos }) to milliseconds. */
function durationToMs(d: GoogleDuration | undefined | null): number {
  if (!d) return 0;
  const seconds = typeof d.seconds === "string" ? Number(d.seconds) : (d.seconds ?? 0);
  const nanos = d.nanos ?? 0;
  return Math.round(seconds * 1000 + nanos / 1e6);
}

/** Google v2 diarisation speaker tags (1, 2, 3, …) → role labels. */
function normaliseSpeaker(s: number | undefined): SpeakerLabel {
  switch (s) {
    case 1:
      return "doctor";
    case 2:
      return "patient";
    case 3:
      return "other";
    default:
      return "unknown";
  }
}

/** Map a Google API/gRPC error to the right ASRError subtype. */
function mapGoogleError(err: unknown, providerName: string): never {
  // gRPC status codes: 16 UNAUTHENTICATED, 7 PERMISSION_DENIED, 3 INVALID_ARGUMENT,
  // 8 RESOURCE_EXHAUSTED, 4 DEADLINE_EXCEEDED, 14 UNAVAILABLE, 13 INTERNAL.
  const code = (err as { code?: number }).code;
  const message = err instanceof Error ? err.message : String(err);
  if (code === 16 || code === 7) {
    throw new ASRPermanentError(message, ASRErrorCode.AUTH_FAILURE, providerName);
  }
  if (code === 3) {
    throw new ASRPermanentError(message, ASRErrorCode.INVALID_AUDIO, providerName);
  }
  if (code === 8) {
    throw new ASRTransientError(message, ASRErrorCode.RATE_LIMIT, providerName);
  }
  if (code === 4) {
    throw new ASRTransientError(message, ASRErrorCode.TIMEOUT, providerName);
  }
  if (code === 14 || code === 13) {
    throw new ASRTransientError(message, ASRErrorCode.UNKNOWN, providerName);
  }
  throw new ASRTransientError(message, ASRErrorCode.UNKNOWN, providerName);
}

interface GoogleDuration {
  seconds?: number | string | null;
  nanos?: number | null;
}

interface GoogleWord {
  word?: string;
  startOffset?: GoogleDuration | null;
  endOffset?: GoogleDuration | null;
  confidence?: number;
  speakerLabel?: string | null;
  speakerTag?: number;
}

interface GoogleRecognizeResponse {
  results?: Array<{
    languageCode?: string;
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
      words?: GoogleWord[];
    }>;
  }>;
}
