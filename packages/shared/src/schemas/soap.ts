import { z } from "zod";

/**
 * Server-side Zod schemas for LLM tool-call validation (PRD §6.3.6).
 * Validation runs with safeParse() BEFORE any DB write. The model is never
 * trusted to return a well-formed object.
 */

export const PrescriptionItemSchema = z.object({
  drug_name: z.string().min(1),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  route: z.string().nullable(),
  duration: z.string().nullable(),
  instructions: z.string().nullable(),
  quantity: z.string().nullable(),
});
export type PrescriptionItem = z.infer<typeof PrescriptionItemSchema>;

export const PrescriptionListZod = z.object({
  prescriptions: z.array(PrescriptionItemSchema),
  extraction_notes: z.string().nullable().optional(),
});
export type PrescriptionList = z.infer<typeof PrescriptionListZod>;

export const SOAPNoteZod = z.object({
  // These four are grounding-critical but nullable: a transcript with no
  // identifiable clinical content (garbled ASR, non-medical audio) has no
  // truthful non-empty value to put here. Forcing z.string().min(1) left the
  // model no valid way to comply with both "return null when absent" and a
  // non-nullable, non-empty schema — it resolved the conflict by emitting the
  // literal string "null" or fabricating content from unrelated transcript
  // text. Null must flow through so callers can render/gate on "no content
  // found" explicitly instead of a garbage placeholder.
  chief_complaint: z.string().min(1).nullable(),
  subjective: z.object({
    history_of_present_illness: z.string().min(1).nullable(),
    past_medical_history: z.string().nullable(),
    medications_reported_by_patient: z.string().nullable(),
    allergies: z.string().nullable(),
    review_of_systems: z.string().nullable(),
  }),
  objective: z.object({
    vital_signs: z.string().nullable(),
    physical_examination: z.string().nullable(),
    investigations_ordered: z.string().nullable(),
    investigations_reported: z.string().nullable(),
  }),
  assessment: z.object({
    primary_diagnosis: z.string().min(1).nullable(),
    differential_diagnoses: z.array(z.string()).nullable(),
    clinical_impression: z.string().nullable(),
  }),
  plan: z.object({
    treatment_plan: z.string().min(1).nullable(),
    prescriptions_raw: z.string().nullable(),
    referrals: z.string().nullable(),
    patient_education: z.string().nullable(),
    follow_up: z.string().nullable(),
  }),
  note_language: z.enum(["en", "hi-roman", "mixed"]),
  transcript_duration_seconds: z.number().nonnegative(),
});
export type SOAPNote = z.infer<typeof SOAPNoteZod>;

/** Plain-language patient visit summary (PRD §5.5). */
export const VisitSummaryZod = z.object({
  chief_complaint_plain: z.string().min(1),
  diagnosis_plain: z.string().min(1),
  medications: z.array(
    z.object({
      name: z.string().min(1),
      how_to_take: z.string().nullable(),
    }),
  ),
  lifestyle_advice: z.string().nullable(),
  follow_up: z.string().nullable(),
});
export type VisitSummary = z.infer<typeof VisitSummaryZod>;
