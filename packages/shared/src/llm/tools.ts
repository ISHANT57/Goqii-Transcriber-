/**
 * Provider-neutral tool/function-call definitions for the two-call
 * note-generation architecture (PRD §6.3.3). JSON Schemas mirror the Zod
 * schemas in ../schemas/soap.ts, written in Anthropic `tool_use` dialect;
 * callers translate to their provider's schema dialect at call time (e.g.
 * `toGeminiSchema` in apps/worker/src/lib/gemini.ts).
 *
 * Typed loosely as `unknown`-friendly objects so this package does not need a
 * hard dependency on any single LLM provider's SDK.
 */

export interface LLMToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const nullableString = { type: ["string", "null"] } as const;

export const SOAP_TOOL: LLMToolDef = {
  name: "generate_soap_note",
  description:
    "Generate a structured SOAP clinical note from the provided transcript. " +
    "All fields must be grounded in the transcript. Return null for any field " +
    "not mentioned. Do not infer, expand, or guess.",
  input_schema: {
    type: "object",
    properties: {
      chief_complaint: nullableString,
      subjective: {
        type: "object",
        properties: {
          history_of_present_illness: nullableString,
          past_medical_history: nullableString,
          medications_reported_by_patient: nullableString,
          allergies: nullableString,
          review_of_systems: nullableString,
        },
        required: [
          "history_of_present_illness",
          "past_medical_history",
          "medications_reported_by_patient",
          "allergies",
          "review_of_systems",
        ],
        additionalProperties: false,
      },
      objective: {
        type: "object",
        properties: {
          vital_signs: nullableString,
          physical_examination: nullableString,
          investigations_ordered: nullableString,
          investigations_reported: nullableString,
        },
        required: [
          "vital_signs",
          "physical_examination",
          "investigations_ordered",
          "investigations_reported",
        ],
        additionalProperties: false,
      },
      assessment: {
        type: "object",
        properties: {
          primary_diagnosis: nullableString,
          differential_diagnoses: {
            type: ["array", "null"],
            items: { type: "string" },
          },
          clinical_impression: nullableString,
        },
        required: ["primary_diagnosis", "differential_diagnoses", "clinical_impression"],
        additionalProperties: false,
      },
      plan: {
        type: "object",
        properties: {
          treatment_plan: nullableString,
          prescriptions_raw: nullableString,
          referrals: nullableString,
          patient_education: nullableString,
          follow_up: nullableString,
        },
        required: [
          "treatment_plan",
          "prescriptions_raw",
          "referrals",
          "patient_education",
          "follow_up",
        ],
        additionalProperties: false,
      },
      note_language: { type: "string", enum: ["en", "hi-roman", "mixed"] },
      transcript_duration_seconds: { type: "number" },
    },
    required: [
      "chief_complaint",
      "subjective",
      "objective",
      "assessment",
      "plan",
      "note_language",
      "transcript_duration_seconds",
    ],
    additionalProperties: false,
  },
};

export const PRESCRIPTION_TOOL: LLMToolDef = {
  name: "extract_prescriptions",
  description:
    "Extract all prescriptions from the provided plan text. " +
    "Drug names and dosage units must appear verbatim in the input text. " +
    "Do not expand abbreviations or convert units. " +
    "Return an empty array if no prescriptions are present.",
  input_schema: {
    type: "object",
    properties: {
      prescriptions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            drug_name: { type: "string" },
            dosage: nullableString,
            frequency: nullableString,
            route: nullableString,
            duration: nullableString,
            instructions: nullableString,
            quantity: nullableString,
          },
          required: [
            "drug_name",
            "dosage",
            "frequency",
            "route",
            "duration",
            "instructions",
            "quantity",
          ],
          additionalProperties: false,
        },
      },
      extraction_notes: nullableString,
    },
    required: ["prescriptions"],
    additionalProperties: false,
  },
};

export const VISIT_SUMMARY_TOOL: LLMToolDef = {
  name: "generate_visit_summary",
  description:
    "Generate a plain-language visit summary for the patient from the finalised " +
    "clinical note. Avoid medical jargon. Only use information present in the note.",
  input_schema: {
    type: "object",
    properties: {
      chief_complaint_plain: { type: "string" },
      diagnosis_plain: { type: "string" },
      medications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            how_to_take: nullableString,
          },
          required: ["name", "how_to_take"],
          additionalProperties: false,
        },
      },
      lifestyle_advice: nullableString,
      follow_up: nullableString,
    },
    required: [
      "chief_complaint_plain",
      "diagnosis_plain",
      "medications",
      "lifestyle_advice",
      "follow_up",
    ],
    additionalProperties: false,
  },
};
