-- 0015_processing_jobs.sql
-- Durable background-job queue (Postgres-backed).
--
-- Previously transcription / note / summary generation ran as in-process
-- `setTimeout` fire-and-forget calls. If the API process restarted mid-job (a
-- deploy, an OOM, a Render free-tier idle spin-down) the work was lost silently
-- and the session was stranded in a transient status forever.
--
-- This table makes each job durable: it survives restarts, is retried with
-- backoff on transient failure, and orphaned "running" rows (from a crash) are
-- reclaimed on the next boot. No Redis required — stays on the free tier.

CREATE TABLE processing_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
                 CHECK (type IN ('transcribe', 'generate_note', 'generate_summary')),
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'running', 'done', 'failed')),
  attempts     INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error   TEXT,
  run_after    TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Claim query hits (status, run_after); one partial index covers the hot path.
CREATE INDEX idx_processing_jobs_claim
  ON processing_jobs (run_after)
  WHERE status = 'pending';

CREATE INDEX idx_processing_jobs_session ON processing_jobs (session_id);

-- Server uses the service-role key (bypasses RLS); enable + lock down anyway as
-- defence-in-depth so no direct anon/authenticated client can touch the queue.
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
