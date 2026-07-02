/**
 * Shared error type for the two-call note-generation architecture
 * (PRD §6.3.5). Provider-neutral: used by the Gemini call path in worker.ts.
 */

/**
 * Terminal note-generation failure. When thrown, the worker must set the
 * session to `note_failed`, store the reason, and stop — no further retry.
 */
export class NoteFailedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "NoteFailedError";
  }
}
