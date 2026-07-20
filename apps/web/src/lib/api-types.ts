/**
 * API response shapes assumed for the @gooqi/api server.
 *
 * These mirror `@gooqi/shared` DB types but flatten/join what the endpoints
 * are expected to return. Where the exact shape was not specified, sensible
 * assumptions were made (documented in the app handover notes).
 */
import type {
  Patient,
  Session,
  SessionStatus,
  Turn,
} from "@gooqi/shared";

/** A row in GET /api/patients — patient plus visit aggregates. */
export interface PatientListItem extends Patient {
  session_count: number;
  last_visit_at: string | null;
}

/** A row in GET /api/patients/:id/sessions — session + latest-note summary. */
export interface PatientSessionItem extends Session {
  chief_complaint: string | null;
  primary_diagnosis: string | null;
}

/** GET/PATCH /api/doctor/me — the authenticated doctor's profile. */
export interface DoctorProfile {
  id: string;
  name: string;
  registration_number: string | null;
  clinic_name: string | null;
  created_at: string;
}

/** A row in the GET /api/sessions list — session joined with patient + note summary. */
export interface SessionListItem {
  id: string;
  status: SessionStatus;
  created_at: string;
  started_at: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  chief_complaint: string | null;
  primary_diagnosis: string | null;
}

/** GET /api/sessions/:id — full session, optionally with joined patient. */
export interface SessionDetail extends Session {
  patient_name?: string | null;
  patient_phone?: string | null;
}

/** GET /api/sessions/:id/transcript */
export interface TranscriptResponse {
  turns: Turn[];
  language_detected?: string | null;
  overall_confidence?: number | null;
}

/** A single prescription row as edited in the UI / persisted. */
export interface PrescriptionDraft {
  id?: string;
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  notes: string;
}

/** Editable clinical note fields (flattened SOAP). */
export interface NoteFields {
  chief_complaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  primary_diagnosis: string;
  differentials: string[];
  follow_up: string;
  follow_up_date: string | null;
  no_medication: boolean;
}

/** A row in GET /api/reminders — a finalised session with a follow-up due soon/overdue. */
export interface ReminderItem {
  session_id: string;
  patient_name: string | null;
  patient_phone: string | null;
  follow_up_date: string;
  overdue: boolean;
}

/** GET /api/analytics */
export interface AnalyticsResponse {
  visitsByWeek: { week: string; count: number }[];
  topDiagnoses: { label: string; count: number }[];
  topDrugs: { label: string; count: number }[];
}

/** A saved SOAP note skeleton ("macro"). */
export interface NoteTemplate {
  id: string;
  name: string;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  follow_up: string | null;
}

/** GET /api/sessions/:id/note */
export interface NoteResponse {
  note: Partial<NoteFields> | null;
  prescriptions: PrescriptionDraft[];
  summary: string | null;
}

/** POST /api/sessions response. */
export interface CreateSessionResponse {
  id: string;
  session?: Session;
}

/** Response from a chunk upload. */
export interface ChunkUploadResponse {
  acknowledgedIndices: number[];
}

/** GET /api/sessions/:id/chunks/acknowledged */
export interface AcknowledgedChunksResponse {
  acknowledgedIndices: number[];
}
