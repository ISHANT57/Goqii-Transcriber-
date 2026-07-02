-- Remove "not working / error" sessions and their orphaned patients.
-- Criteria-based (no hard-coded IDs), so it stays correct as data changes:
--   • abandoned sessions
--   • failed sessions (transcription_failed / note_failed)
--   • sessions stuck mid-pipeline for >1h (recording/uploaded/transcribing/
--     generating_note that never reached draft or final)
-- Every session that produced a real note (draft or final) is KEPT.
--
-- consent_log is append-only (a trigger blocks DELETE); we disable it inside
-- the transaction and re-enable at the end. Doctor accounts are untouched.
--
-- Run in: Supabase Dashboard → SQL Editor → paste → Run.
--
-- PREVIEW FIRST (optional) — see what would be removed:
--   SELECT id, status, started_at FROM sessions
--   WHERE status IN ('abandoned','transcription_failed','note_failed')
--      OR (status IN ('recording','audio_uploaded','transcribing','generating_note')
--          AND started_at < now() - interval '1 hour');

BEGIN;

ALTER TABLE consent_log DISABLE TRIGGER trg_consent_log_immutable;

CREATE TEMP TABLE _dead ON COMMIT DROP AS
SELECT id FROM sessions
WHERE status IN ('abandoned', 'transcription_failed', 'note_failed')
   OR (
     status IN ('recording', 'audio_uploaded', 'transcribing', 'generating_note')
     AND started_at < now() - interval '1 hour'
   );

-- Children first (no ON DELETE CASCADE in this schema).
DELETE FROM prescriptions   WHERE session_id IN (SELECT id FROM _dead);
DELETE FROM clinical_notes  WHERE session_id IN (SELECT id FROM _dead);
DELETE FROM transcripts     WHERE session_id IN (SELECT id FROM _dead);
DELETE FROM visit_summaries WHERE session_id IN (SELECT id FROM _dead);
DELETE FROM audio_chunks    WHERE session_id IN (SELECT id FROM _dead);
DELETE FROM consent_log     WHERE session_id IN (SELECT id FROM _dead);
DELETE FROM sessions        WHERE id         IN (SELECT id FROM _dead);

-- Remove patients left with no sessions and no consent records.
DELETE FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM sessions s     WHERE s.patient_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM consent_log c  WHERE c.patient_id = p.id);

ALTER TABLE consent_log ENABLE TRIGGER trg_consent_log_immutable;

COMMIT;

-- Sanity check — remaining sessions by status:
--   SELECT status, count(*) FROM sessions GROUP BY status ORDER BY status;
