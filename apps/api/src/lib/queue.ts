/**
 * Job enqueue API used by the routes.
 *
 * Backed by the durable Postgres queue (lib/jobs.ts). The function signatures
 * are unchanged so callers (routes) need no edits.
 *
 * Graceful degradation: if the `processing_jobs` table hasn't been migrated yet
 * (JobsTableMissingError), we fall back to the previous in-process
 * fire-and-forget behaviour so the app keeps working until migration 0015 is
 * applied. Once applied, jobs become durable automatically.
 */
import { enqueueJob, JobsTableMissingError } from "./jobs.js";
import {
  processTranscribe,
  processGenerateNote,
  processGenerateSummary,
} from "./processor.js";

/** Run a processor in the background, fire-and-forget (legacy fallback). */
function runInProcess(label: string, fn: () => Promise<void>): void {
  setTimeout(() => {
    fn().catch((err) => console.error(`[queue] in-process ${label} failed:`, err));
  }, 0);
}

/** Enqueue durably; fall back to in-process execution if the table is absent. */
async function enqueueOrRun(
  type: Parameters<typeof enqueueJob>[0],
  sessionId: string,
  payload: Record<string, unknown>,
  fallback: () => Promise<void>,
): Promise<void> {
  try {
    await enqueueJob(type, sessionId, payload);
  } catch (err) {
    if (err instanceof JobsTableMissingError) {
      console.warn(
        `[queue] processing_jobs not migrated — running ${type} in-process (non-durable). Apply migration 0015.`,
      );
      runInProcess(type, fallback);
      return;
    }
    throw err;
  }
}

/** Enqueue a transcription job for a finalised session. */
export async function enqueueTranscription(sessionId: string): Promise<void> {
  await enqueueOrRun("transcribe", sessionId, {}, () => processTranscribe(sessionId));
}

/** Enqueue a SOAP/prescription note-generation job. */
export async function enqueueNoteGeneration(
  sessionId: string,
  transcriptId: string,
): Promise<void> {
  await enqueueOrRun("generate_note", sessionId, { transcriptId }, () =>
    processGenerateNote(sessionId, transcriptId),
  );
}

/** Enqueue a visit-summary generation job after sign-off. */
export async function enqueueSummary(sessionId: string): Promise<void> {
  await enqueueOrRun("generate_summary", sessionId, {}, () =>
    processGenerateSummary(sessionId),
  );
}
