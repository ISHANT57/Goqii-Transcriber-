/**
 * Durable, Postgres-backed background-job runner.
 *
 * Replaces fire-and-forget `setTimeout` execution with jobs persisted in the
 * `processing_jobs` table (migration 0015). Benefits:
 *   - survives process restart / crash / free-tier spin-down (no silent loss);
 *   - retries transient failures with exponential backoff;
 *   - reclaims jobs orphaned by a crash on the next boot.
 *
 * No Redis: this stays entirely on Supabase Postgres and the free tier. The
 * runner processes jobs one-at-a-time to bound memory (a single audio buffer /
 * Gemini call in flight) on a small instance — CONCURRENCY is the tuning knob.
 *
 * Public surface is intentionally tiny: enqueueJob(), startJobRunner().
 */
import { supabase } from "./supabase.js";
import {
  processTranscribe,
  processGenerateNote,
  processGenerateSummary,
} from "./processor.js";

export type JobType = "transcribe" | "generate_note" | "generate_summary";

interface JobRow {
  id: string;
  session_id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/** Thrown by enqueueJob when the jobs table hasn't been migrated yet. */
export class JobsTableMissingError extends Error {
  constructor() {
    super("processing_jobs table is missing — apply migration 0015");
    this.name = "JobsTableMissingError";
  }
}

const CONCURRENCY = 1;
const POLL_INTERVAL_MS = 10_000;
const MAX_BACKOFF_SECONDS = 60;

/** True if a PostgREST error means the table/relation does not exist. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" || // undefined_table
    err.code === "PGRST205" || // schema cache: table not found
    /processing_jobs/.test(err.message ?? "") &&
      /does not exist|not find the table/i.test(err.message ?? "")
  );
}

/**
 * Persist a job. Returns once the row is committed (so a failed insert surfaces
 * to the caller as an "un-queueable" error). Kicks the runner for immediacy.
 * Throws JobsTableMissingError if the table hasn't been migrated yet, so the
 * caller can fall back to direct execution.
 */
export async function enqueueJob(
  type: JobType,
  sessionId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from("processing_jobs")
    .insert({ type, session_id: sessionId, payload, status: "pending" });

  if (error) {
    if (isMissingTable(error)) throw new JobsTableMissingError();
    throw new Error(`failed to enqueue ${type} job: ${error.message}`);
  }
  kickRunner();
}

// ─── Runner ─────────────────────────────────────────────────────────────────

let draining = false;

/** Dispatch a claimed job to its processor. */
async function runJob(job: JobRow): Promise<void> {
  switch (job.type) {
    case "transcribe":
      await processTranscribe(job.session_id);
      return;
    case "generate_note": {
      const transcriptId = job.payload.transcriptId;
      if (typeof transcriptId !== "string") {
        throw new Error("generate_note job missing payload.transcriptId");
      }
      await processGenerateNote(job.session_id, transcriptId);
      return;
    }
    case "generate_summary":
      await processGenerateSummary(job.session_id);
      return;
    default:
      throw new Error(`unknown job type: ${(job as JobRow).type}`);
  }
}

/** Atomically claim the next due pending job, or null if none. */
async function claimNext(): Promise<JobRow | null> {
  const nowIso = new Date().toISOString();
  const { data: candidate, error } = await supabase
    .from("processing_jobs")
    .select("id, session_id, type, payload, attempts, max_attempts")
    .eq("status", "pending")
    .lte("run_after", nowIso)
    .order("run_after", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (!isMissingTable(error)) {
      console.error("[jobs] claim query failed:", error.message);
    }
    return null;
  }
  if (!candidate) return null;

  // Claim it: succeed only if still pending (guards against a double-claim).
  const { data: claimed } = await supabase
    .from("processing_jobs")
    .update({
      status: "running",
      locked_at: nowIso,
      attempts: (candidate.attempts as number) + 1,
      updated_at: nowIso,
    })
    .eq("id", candidate.id as string)
    .eq("status", "pending")
    .select("id, session_id, type, payload, attempts, max_attempts")
    .maybeSingle();

  return (claimed as JobRow | null) ?? null;
}

/** Mark a job done, or reschedule with backoff / fail after max attempts. */
async function settle(job: JobRow, err: unknown): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!err) {
    await supabase
      .from("processing_jobs")
      .update({ status: "done", updated_at: nowIso, last_error: null })
      .eq("id", job.id);
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  if (job.attempts < job.max_attempts) {
    const backoff = Math.min(MAX_BACKOFF_SECONDS, 5 * 2 ** (job.attempts - 1));
    const runAfter = new Date(Date.now() + backoff * 1000).toISOString();
    console.warn(
      `[jobs] ${job.type} (${job.id}) failed, retry ${job.attempts}/${job.max_attempts} in ${backoff}s: ${message}`,
    );
    await supabase
      .from("processing_jobs")
      .update({
        status: "pending",
        run_after: runAfter,
        locked_at: null,
        last_error: message,
        updated_at: nowIso,
      })
      .eq("id", job.id);
  } else {
    console.error(`[jobs] ${job.type} (${job.id}) failed permanently: ${message}`);
    await supabase
      .from("processing_jobs")
      .update({ status: "failed", last_error: message, updated_at: nowIso })
      .eq("id", job.id);
  }
}

/** Drain due jobs until none remain. Re-entrant-safe via the `draining` flag. */
async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const batch: JobRow[] = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        const job = await claimNext();
        if (!job) break;
        batch.push(job);
      }
      if (batch.length === 0) break;

      await Promise.all(
        batch.map(async (job) => {
          try {
            await runJob(job);
            await settle(job, null);
          } catch (err) {
            await settle(job, err);
          }
        }),
      );
    }
  } finally {
    draining = false;
  }
}

/** Fire the drain loop without awaiting (safe to call from request handlers). */
export function kickRunner(): void {
  void drain().catch((err) => console.error("[jobs] drain crashed:", err));
}

/**
 * Reclaim jobs left "running" by a crashed/restarted process. On a single
 * instance every "running" row at boot is orphaned, so reset them all to
 * pending for immediate re-pickup.
 */
async function recoverOrphaned(): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("processing_jobs")
    .update({ status: "pending", locked_at: null, run_after: nowIso, updated_at: nowIso })
    .eq("status", "running");
  if (error && !isMissingTable(error)) {
    console.error("[jobs] orphan recovery failed:", error.message);
  }
}

/**
 * Start the background runner: recover orphaned jobs, drain the backlog, and
 * poll periodically so backoff-scheduled retries eventually run. Idempotent-ish
 * — call once at boot.
 */
export async function startJobRunner(): Promise<void> {
  await recoverOrphaned();
  kickRunner();
  const timer = setInterval(kickRunner, POLL_INTERVAL_MS);
  // Don't keep the event loop alive solely for the poller.
  timer.unref?.();
}
