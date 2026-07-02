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
 * Sarvam AI provider — Saarika speech-to-text, BATCH job endpoint, WITH
 * diarization. Confirmed against the live API end-to-end (2026-07-01); no
 * public curl/raw-HTTP walkthrough exists in Sarvam's docs (only a Python/JS
 * SDK example), so every request/response shape below was verified directly:
 *
 *   1. POST   /speech-to-text/job/v1               → {job_id, job_state}
 *   2. POST   /speech-to-text/job/v1/upload-files   → {upload_urls: {filename: {file_url}}}
 *   3. PUT    <file_url>                            → upload raw audio bytes
 *      (file_url is an Azure Blob SAS URL — requires header
 *      `x-ms-blob-type: BlockBlob`, otherwise Azure rejects the PUT)
 *   4. POST   /speech-to-text/job/v1/{job_id}/start → kicks off processing
 *   5. GET    /speech-to-text/job/v1/{job_id}/status (poll until Completed/Failed)
 *   6. POST   /speech-to-text/job/v1/download-files → {download_urls: {filename: {file_url}}}
 *   7. GET    <file_url>                            → SpeechToTextResponse JSON
 *      (same `diarized_transcript.entries` shape as the real-time endpoint)
 *
 * This is inherently much slower than the real-time endpoint (job
 * create+upload+start+poll+download takes tens of seconds even for a few
 * seconds of audio) — use this provider only when true doctor/patient speaker
 * separation is required; otherwise prefer the plain `sarvam` provider.
 *
 * Env: SARVAM_API_KEY (same credential as the real-time provider).
 */
const JOB_BASE = "https://api.sarvam.ai/speech-to-text/job/v1";
const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_ATTEMPTS = 150; // ~10 minutes

const AUDIO_CONTENT_TYPE: Record<TranscribeOptions["audioFormat"], string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  ogg: "audio/ogg",
};

interface JobDetail {
  inputs: { file_name: string; file_id: string }[];
  outputs: { file_name: string; file_id: string }[];
  state: "Success" | "API Error" | "Internal Server Error";
  error_message?: string | null;
}

interface JobStatusResponse {
  job_state: "Accepted" | "Pending" | "Running" | "Completed" | "Failed";
  job_id: string;
  error_message?: string;
  job_details?: JobDetail[];
}

export class SarvamBatchASRProvider extends ASRProvider {
  private readonly apiKey: string;

  constructor(apiKey = process.env.SARVAM_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  getName(): string {
    return "Sarvam-Batch";
  }

  async getHealthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }

  private headers(json = true): Record<string, string> {
    return {
      "api-subscription-key": this.apiKey,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
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

    // 1) Fetch the signed audio bytes — the job API needs them uploaded to its
    //    own presigned storage, not linked by our Supabase URL.
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

    const languageCode = toSarvamLanguageCode(options.language);
    const contentType = AUDIO_CONTENT_TYPE[options.audioFormat];
    const fileName = `audio.${options.audioFormat}`;

    // 2) Initialise the job.
    const jobId = await this.initJob(languageCode, options);

    // 3) Get a presigned upload URL, then PUT the audio bytes to it.
    const uploadUrl = await this.getUploadUrl(jobId, fileName);
    await this.uploadBytes(uploadUrl, audioBuffer, contentType);

    // 4) Start processing.
    await this.startJob(jobId);

    // 5) Poll until the job finishes (or times out).
    const detail = await this.pollUntilDone(jobId);

    // 6) Resolve the output filename and download the transcript JSON.
    const outputFile = detail.outputs[0]?.file_name;
    if (!outputFile) {
      throw new ASRTransientError(
        "Job completed but reported no output file",
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }
    const raw = await this.downloadResult(jobId, outputFile);

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

  private async initJob(languageCode: string, options: TranscribeOptions): Promise<string> {
    const res = await this.fetchJson(JOB_BASE, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        job_parameters: {
          model: "saarika:v2.5",
          language_code: languageCode,
          with_timestamps: true,
          with_diarization: true,
          num_speakers: options.speakerCount ?? 2,
          // Mirrors the real-time provider: without this, Sarvam returns
          // Devanagari script even when the caller asked for Roman
          // transliteration (the app's LLM pipeline is tuned for Roman input).
          ...(options.scriptOutput === "roman" ? { script: "roman" } : {}),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json()) as { job_id: string };
    return body.job_id;
  }

  private async getUploadUrl(jobId: string, fileName: string): Promise<string> {
    const res = await this.fetchJson(`${JOB_BASE}/upload-files`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ job_id: jobId, files: [fileName] }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json()) as {
      upload_urls: Record<string, { file_url: string }>;
    };
    const entry = body.upload_urls[fileName];
    if (!entry) {
      throw new ASRTransientError(
        "Upload URL response did not include the requested file",
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }
    return entry.file_url;
  }

  private async uploadBytes(fileUrl: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(fileUrl, {
        method: "PUT",
        // Azure Blob Storage SAS URLs require this header for a single-shot PUT.
        headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": contentType },
        body: bytes,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new ASRTransientError(
        err instanceof Error ? err.message : String(err),
        ASRErrorCode.TIMEOUT,
        this.getName(),
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ASRTransientError(
        `Audio upload failed (${res.status}): ${body.slice(0, 500)}`,
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }
  }

  private async startJob(jobId: string): Promise<void> {
    await this.fetchJson(`${JOB_BASE}/${jobId}/start`, {
      method: "POST",
      headers: this.headers(false),
      signal: AbortSignal.timeout(30_000),
    });
  }

  private async pollUntilDone(jobId: string): Promise<JobDetail> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const res = await this.fetchJson(`${JOB_BASE}/${jobId}/status`, {
        method: "GET",
        headers: this.headers(false),
        signal: AbortSignal.timeout(30_000),
      });
      const status = (await res.json()) as JobStatusResponse;

      if (status.job_state === "Completed") {
        const detail = status.job_details?.[0];
        if (!detail || detail.state !== "Success") {
          throw new ASRTransientError(
            `Job completed but file-level state was ${detail?.state ?? "missing"}: ${detail?.error_message ?? ""}`,
            ASRErrorCode.UNKNOWN,
            this.getName(),
          );
        }
        return detail;
      }
      if (status.job_state === "Failed") {
        const detail = status.job_details?.[0];
        // "API Error" (bad/unsupported input) won't be fixed by retrying the
        // same audio; "Internal Server Error" is Sarvam-side and worth retrying.
        if (detail?.state === "API Error") {
          throw new ASRPermanentError(
            `Sarvam batch job failed: ${detail.error_message ?? status.error_message ?? "unknown"}`,
            ASRErrorCode.INVALID_AUDIO,
            this.getName(),
          );
        }
        throw new ASRTransientError(
          `Sarvam batch job failed: ${detail?.error_message ?? status.error_message ?? "unknown"}`,
          ASRErrorCode.UNKNOWN,
          this.getName(),
        );
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new ASRTransientError(
      `Job did not complete within ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`,
      ASRErrorCode.TIMEOUT,
      this.getName(),
    );
  }

  private async downloadResult(jobId: string, outputFile: string): Promise<SarvamResponse> {
    const res = await this.fetchJson(`${JOB_BASE}/download-files`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ job_id: jobId, files: [outputFile] }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json()) as {
      download_urls: Record<string, { file_url: string }>;
    };
    const entry = body.download_urls[outputFile];
    if (!entry) {
      throw new ASRTransientError(
        "Download URL response did not include the requested file",
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }
    const fileRes = await fetch(entry.file_url, { signal: AbortSignal.timeout(30_000) });
    if (!fileRes.ok) {
      throw new ASRTransientError(
        `Failed to download transcript (${fileRes.status})`,
        ASRErrorCode.UNKNOWN,
        this.getName(),
      );
    }
    return (await fileRes.json()) as SarvamResponse;
  }

  /** Shared fetch wrapper: classifies auth/quota/5xx failures consistently across every job-API call. */
  private async fetchJson(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(url, init);
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
    if (res.status === 400 || res.status === 422) {
      const body = await res.text().catch(() => "");
      throw new ASRPermanentError(
        `Invalid request (${res.status}): ${body.slice(0, 500)}`,
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
    return res;
  }
}
