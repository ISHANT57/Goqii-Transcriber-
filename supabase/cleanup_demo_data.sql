-- One-off demo-data cleanup: keep ONLY the two showcase examples
--   • Ramesh Kumar  — final  (Fever and dry cough / Acute viral URTI)
--   • Sunita Devi   — draft  (Headache and dizziness / Tension headache)
-- and remove all other test/demo sessions + patients.
--
-- The consent_log table is append-only (a trigger blocks DELETE), so this
-- temporarily disables that trigger inside a single transaction and re-enables
-- it at the end. Run in: Supabase Dashboard → SQL Editor → paste → Run.
--
-- Doctor accounts (doctors table) are left untouched.

BEGIN;

ALTER TABLE consent_log DISABLE TRIGGER trg_consent_log_immutable;

-- Children first (no ON DELETE CASCADE in this schema).
DELETE FROM prescriptions   WHERE session_id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');
DELETE FROM clinical_notes  WHERE session_id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');
DELETE FROM transcripts     WHERE session_id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');
DELETE FROM visit_summaries WHERE session_id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');
DELETE FROM audio_chunks    WHERE session_id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');
DELETE FROM consent_log     WHERE session_id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');

-- Sessions, then patients (sessions.patient_id / consent_log.patient_id → patients).
DELETE FROM sessions        WHERE id NOT IN
  ('2b071c8c-47a2-43ff-ad87-71f9fc3a7750','487acd6a-09dc-4cc8-8e13-b8f934dcb883');
DELETE FROM patients        WHERE id NOT IN
  ('01245790-5b71-4808-85de-6e69e62bf60e','c6ad2f42-73ee-4285-b292-5c24a7586c68');

ALTER TABLE consent_log ENABLE TRIGGER trg_consent_log_immutable;

COMMIT;

-- Sanity check (should return exactly 2 patients and 2 sessions):
-- SELECT (SELECT count(*) FROM patients) AS patients, (SELECT count(*) FROM sessions) AS sessions;
