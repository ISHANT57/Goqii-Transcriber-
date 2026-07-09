/**
 * In-process task queue simulation.
 * Executes tasks asynchronously using fire-and-forget Promise chains to bypass Redis dependency.
 */
import {
  processTranscribe,
  processGenerateNote,
  processGenerateSummary,
} from "./processor.js";

/**
 * Enqueue a transcription job for a finalised session.
 * Runs in the background of the Express process.
 */
export async function enqueueTranscription(sessionId: string): Promise<void> {
  // Fire and forget
  setTimeout(() => {
    processTranscribe(sessionId).catch((err) => {
      console.error(`[queue] in-process transcribe failed for session ${sessionId}:`, err);
    });
  }, 0);
}

/**
 * Enqueue a SOAP/prescription note-generation job.
 * Runs in the background of the Express process.
 */
export async function enqueueNoteGeneration(
  sessionId: string,
  transcriptId: string,
): Promise<void> {
  // Fire and forget
  setTimeout(() => {
    processGenerateNote(sessionId, transcriptId).catch((err) => {
      console.error(`[queue] in-process generate-note failed for session ${sessionId}:`, err);
    });
  }, 0);
}

/**
 * Enqueue a visit-summary generation job after sign-off.
 * Runs in the background of the Express process.
 */
export async function enqueueSummary(sessionId: string): Promise<void> {
  // Fire and forget
  setTimeout(() => {
    processGenerateSummary(sessionId).catch((err) => {
      console.error(`[queue] in-process generate-summary failed for session ${sessionId}:`, err);
    });
  }, 0);
}
