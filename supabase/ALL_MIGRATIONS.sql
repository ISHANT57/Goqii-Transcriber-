-- Gooqi Health Transcriber — combined migrations
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- (Idempotent-ish: run once on a fresh project.)


-- ============================================================
-- 0001_doctors.sql
-- ============================================================
-- 0001_doctors.sql
-- Doctors extend Supabase auth.users (1:1). The PK is the auth user id.

CREATE TABLE doctors (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  registration_number TEXT,
  clinic_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 0002_patients.sql
-- ============================================================
-- 0002_patients.sql
-- Patients belong to exactly one doctor.

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  name TEXT NOT NULL,
  phone TEXT,
  dob DATE,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patients_doctor ON patients(doctor_id);

-- ============================================================
-- 0003_sessions.sql
-- ============================================================
-- 0003_sessions.sql
-- session_status enum + sessions table.
-- Enum values mirror packages/shared/src/db/types.ts (SessionStatus),
-- including 'abandoned' for discarded recordings.

CREATE TYPE session_status AS ENUM (
  'recording',
  'audio_uploaded',
  'transcribing',
  'transcription_failed',
  'generating_note',
  'note_failed',
  'draft',
  'final',
  'abandoned'
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  status session_status NOT NULL DEFAULT 'recording',
  audio_url TEXT,
  audio_duration_ms INT,
  consent_logged BOOLEAN NOT NULL DEFAULT false,
  consent_text_version TEXT,
  consent_language TEXT NOT NULL DEFAULT 'en',
  consent_timestamp TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  finalised_at TIMESTAMPTZ,
  asr_provider TEXT,
  -- Adjustments per shared types:
  audio_purged_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_doctor ON sessions(doctor_id);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- ============================================================
-- 0004_audio_chunks.sql
-- ============================================================
-- 0004_audio_chunks.sql
-- Streamed audio chunks for a session (one row per uploaded slice).

CREATE TABLE audio_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  chunk_index INT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, chunk_index)
);

CREATE INDEX idx_audio_chunks_session ON audio_chunks(session_id);

-- ============================================================
-- 0005_transcripts.sql
-- ============================================================
-- 0005_transcripts.sql
-- Transcripts (versioned: ai_generated or doctor_edited).
-- raw_provider_response / language_detected / overall_confidence are written
-- by the worker (see shared TranscriptRow).

CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  version TEXT NOT NULL CHECK (version IN ('ai_generated','doctor_edited')),
  edit_number INT NOT NULL DEFAULT 1,
  turns JSONB NOT NULL,
  -- Adjustments per shared types:
  raw_provider_response JSONB,
  language_detected TEXT,
  overall_confidence REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_transcripts_turns_gin ON transcripts USING GIN (turns);

-- ============================================================
-- 0006_clinical_notes.sql
-- ============================================================
-- 0006_clinical_notes.sql
-- Structured clinical notes (versioned: ai_generated or doctor_edited).

CREATE TABLE clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  version TEXT NOT NULL CHECK (version IN ('ai_generated','doctor_edited')),
  edit_number INT NOT NULL DEFAULT 1,
  chief_complaint TEXT,
  primary_diagnosis TEXT,
  differentials TEXT[],
  follow_up TEXT,
  no_medication BOOLEAN NOT NULL DEFAULT false,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clinical_notes_session ON clinical_notes(session_id);

-- ============================================================
-- 0007_prescriptions.sql
-- ============================================================
-- 0007_prescriptions.sql
-- Prescription line items attached to a clinical note.

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  note_id UUID NOT NULL REFERENCES clinical_notes(id),
  drug_name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  duration TEXT,
  route TEXT,
  notes TEXT,
  sort_order INT
);

CREATE INDEX idx_prescriptions_session ON prescriptions(session_id);
CREATE INDEX idx_prescriptions_note ON prescriptions(note_id);

-- ============================================================
-- 0008_visit_summaries.sql
-- ============================================================
-- 0008_visit_summaries.sql
-- Plain-language visit summary for the patient.

CREATE TABLE visit_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One visit summary per session; UNIQUE enables the worker's upsert
  -- (on_conflict = session_id) when (re)generating the summary.
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id),
  content TEXT NOT NULL,
  edited_by_doctor BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visit_summaries_session ON visit_summaries(session_id);

-- ============================================================
-- 0009_consent_log.sql
-- ============================================================
-- 0009_consent_log.sql
-- Append-only consent audit trail. UPDATE/DELETE are blocked by a trigger.

CREATE TABLE consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_language TEXT NOT NULL DEFAULT 'en',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_consent_log_session ON consent_log(session_id);
CREATE INDEX idx_consent_log_doctor ON consent_log(doctor_id);

CREATE OR REPLACE FUNCTION consent_log_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'consent_log is append-only: UPDATE and DELETE are not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consent_log_immutable
  BEFORE UPDATE OR DELETE ON consent_log
  FOR EACH ROW EXECUTE FUNCTION consent_log_immutable();

-- ============================================================
-- 0010_rls.sql
-- ============================================================
-- 0010_rls.sql
-- Row Level Security. A doctor may only see their own data.
--
-- NOTE: the API server uses the Supabase service-role key, which BYPASSES RLS.
-- These policies are a defence-in-depth measure protecting any direct client
-- (anon/authenticated) access via the Supabase JS client.

-- ---------------------------------------------------------------------------
-- doctors: a doctor can see/update only their own row.
-- ---------------------------------------------------------------------------
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctors_select_own ON doctors
  FOR SELECT USING (id = auth.uid());

CREATE POLICY doctors_update_own ON doctors
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- patients: scoped directly by doctor_id.
-- ---------------------------------------------------------------------------
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY patients_select_own ON patients
  FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY patients_insert_own ON patients
  FOR INSERT WITH CHECK (doctor_id = auth.uid());

CREATE POLICY patients_update_own ON patients
  FOR UPDATE USING (doctor_id = auth.uid()) WITH CHECK (doctor_id = auth.uid());

CREATE POLICY patients_delete_own ON patients
  FOR DELETE USING (doctor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sessions: scoped directly by doctor_id.
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_select_own ON sessions
  FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY sessions_insert_own ON sessions
  FOR INSERT WITH CHECK (doctor_id = auth.uid());

CREATE POLICY sessions_update_own ON sessions
  FOR UPDATE USING (doctor_id = auth.uid()) WITH CHECK (doctor_id = auth.uid());

CREATE POLICY sessions_delete_own ON sessions
  FOR DELETE USING (doctor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Child tables: scoped through the owning session.
-- ---------------------------------------------------------------------------
ALTER TABLE audio_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_chunks_own ON audio_chunks
  FOR ALL
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY transcripts_own ON transcripts
  FOR ALL
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinical_notes_own ON clinical_notes
  FOR ALL
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY prescriptions_own ON prescriptions
  FOR ALL
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

ALTER TABLE visit_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY visit_summaries_own ON visit_summaries
  FOR ALL
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- consent_log: select-only for the owning doctor (append-only enforced by trigger).
-- ---------------------------------------------------------------------------
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_log_select_own ON consent_log
  FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY consent_log_insert_own ON consent_log
  FOR INSERT WITH CHECK (doctor_id = auth.uid());

-- ============================================================
-- 0011_storage.sql
-- ============================================================
-- 0011_storage.sql
-- Private storage bucket for session audio (chunks + assembled files).
-- The API uses the service-role key (bypasses storage RLS); these policies
-- gate any direct authenticated-client access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('session-audio', 'session-audio', false)
ON CONFLICT DO NOTHING;

-- Allow the authenticated role to read/write objects in this bucket.
-- (Kept simple: per-doctor path scoping is enforced by the API layer, which
-- mediates all uploads/downloads with the service role.)
CREATE POLICY "session-audio authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'session-audio');

CREATE POLICY "session-audio authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'session-audio');

CREATE POLICY "session-audio authenticated update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'session-audio')
  WITH CHECK (bucket_id = 'session-audio');

CREATE POLICY "session-audio authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'session-audio');

-- ============================================================
-- 0012_storage_size_limit.sql
-- ============================================================
-- 0012_storage_size_limit.sql
-- Set an explicit object size limit on session-audio instead of relying on
-- an undocumented implicit default. 50MB is the platform ceiling for this
-- project's plan tier (setting a bucket-level limit above it is rejected) —
-- it is also generous headroom over a worst-case MAX_RECORDING_MS (60min)
-- session at the client's configured 32kbps recording bitrate (~14.4MB).

UPDATE storage.buckets
SET file_size_limit = 50 * 1024 * 1024
WHERE id = 'session-audio';
