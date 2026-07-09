/**
 * NoteFailedError — terminal note-generation failure.
 * When thrown, the processor sets session to `note_failed` and does not retry.
 */
export class NoteFailedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "NoteFailedError";
  }
}
