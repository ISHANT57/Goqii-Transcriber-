// Full-pipeline manual analysis: for each file in mockaudios/, create a demo
// patient + session, transcribe via SarvamBatchASRProvider (handles audio
// longer than the real-time endpoint's 30s cap), then run the real two-call
// Gemini SOAP/prescription flow + visit-summary call, and persist everything
// so results are visible in the web app under Dr. Asha Mehta.
//
// Run (from apps/worker): pnpm exec tsx scripts/analyze-mockaudios.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const { config } = await import("dotenv");
config({ path: join(ROOT, ".env") });

const {
  SarvamBatchASRProvider,
  SOAPNoteZod,
  PrescriptionListZod,
  VisitSummaryZod,
  SOAP_TOOL,
  PRESCRIPTION_TOOL,
  VISIT_SUMMARY_TOOL,
  SOAP_SYSTEM_PROMPT,
  PRESCRIPTION_SYSTEM_PROMPT,
  VISIT_SUMMARY_SYSTEM_PROMPT,
  buildRetryPrompt,
  buildTranscriptUserMessage,
} = await import("@gooqi/shared");
const { callGeminiTool, classifyGeminiError } = await import("../src/lib/gemini.js");
const { NoteFailedError } = await import("../src/lib/toolCall.js");

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const AUDIO_BUCKET = "session-audio";
const DOCTOR_ID = "7b47655d-33ec-4ffb-8be8-4ff1dbde6dce"; // Dr. Asha Mehta (seeded)

const MOCK_DIR = join(ROOT, "mockaudios");
const PATIENT_NAMES = ["Ishant", "Janu", "Sandhya", "Disha"];
const files = readdirSync(MOCK_DIR).filter((f) => /\.(mp3|wav|webm|ogg)$/i.test(f)).sort();

console.log(`Found ${files.length} audio files:`, files);
if (files.length !== PATIENT_NAMES.length) {
  console.warn(`WARNING: ${files.length} files but ${PATIENT_NAMES.length} patient names — mapping 1:1 in order, extras ignored.`);
}

function extToFormat(file) {
  const ext = extname(file).slice(1).toLowerCase();
  return ext === "mp3" ? "mp3" : ext === "wav" ? "wav" : ext === "ogg" ? "ogg" : "webm";
}
function contentType(fmt) {
  return { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm" }[fmt];
}

async function setStatus(sessionId, status) {
  await db.from("sessions").update({ status }).eq("id", sessionId);
}
async function setFailure(sessionId, status, reason) {
  await db.from("sessions").update({ status, failure_reason: reason }).eq("id", sessionId);
}

function renderSection(fields) {
  const lines = [];
  for (const [label, value] of fields) {
    if (value === null || value === undefined) continue;
    const text = Array.isArray(value) ? value.join("; ") : value;
    if (String(text).trim() === "") continue;
    lines.push(`${label}: ${text}`);
  }
  return lines.join("\n");
}

async function generateValidated(schema, system, tool, userMessage, label) {
  let prompt = userMessage;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result;
    try {
      result = await callGeminiTool({ system, tool, prompt });
    } catch (err) {
      const failed = classifyGeminiError(err);
      if (failed) throw failed;
      throw err;
    }
    if (result.truncated) throw new NoteFailedError(`${label}_max_tokens`);
    if (result.args == null) {
      if (attempt === 0) {
        prompt = `${userMessage}\n\nYou did not call the ${tool.name} function. You MUST respond by calling it with all required fields. Do not return free text.`;
        continue;
      }
      throw new NoteFailedError(`${label}_no_tool_use`);
    }
    const parsed = schema.safeParse(result.args);
    if (parsed.success) return parsed.data;
    if (attempt === 0) {
      prompt = `${userMessage}\n\n${buildRetryPrompt(JSON.stringify(parsed.error.format(), null, 2))}`;
      continue;
    }
    throw new NoteFailedError(`${label}_validation_failed: ${JSON.stringify(parsed.error.format())}`);
  }
  throw new NoteFailedError(`${label}_exhausted`);
}

const results = [];

for (let i = 0; i < files.length && i < PATIENT_NAMES.length; i++) {
  const file = files[i];
  const patientName = PATIENT_NAMES[i];
  const audioFormat = extToFormat(file);
  console.log(`\n=== [${patientName}] ${file} ===`);
  const report = { patientName, file };

  try {
    // 1) Patient + session.
    const { data: patient, error: pErr } = await db
      .from("patients")
      .insert({ doctor_id: DOCTOR_ID, name: `${patientName} (mockaudio demo)`, phone: null })
      .select("id")
      .single();
    if (pErr) throw new Error(`patient insert: ${pErr.message}`);

    const now = new Date().toISOString();
    const { data: session, error: sErr } = await db
      .from("sessions")
      .insert({
        doctor_id: DOCTOR_ID,
        patient_id: patient.id,
        status: "transcribing",
        consent_logged: true,
        consent_text_version: "v1-2026-06",
        consent_language: "en",
        consent_timestamp: now,
        started_at: now,
        stopped_at: now,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(`session insert: ${sErr.message}`);
    const sessionId = session.id;
    report.sessionId = sessionId;
    console.log(`  session ${sessionId}`);

    // 2) Upload audio directly (single-shot, mirrors the assembled finalise-audio result).
    const bytes = readFileSync(join(MOCK_DIR, file));
    const audioPath = `sessions/${sessionId}/audio.webm`;
    const { error: upErr } = await db.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, bytes, { contentType: contentType(audioFormat), upsert: true });
    if (upErr) throw new Error(`storage upload: ${upErr.message}`);

    const { data: signed, error: urlErr } = await db.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(audioPath, 1800);
    if (urlErr || !signed?.signedUrl) throw new Error(`sign url: ${urlErr?.message}`);

    // 3) Transcribe (batch — handles audio > 30s).
    console.log("  transcribing via Sarvam-Batch…");
    const provider = new SarvamBatchASRProvider();
    const t0 = Date.now();
    const asr = await provider.transcribe(signed.signedUrl, {
      language: "auto",
      speakerCount: 2,
      maxSpeakers: 3,
      audioFormat,
      scriptOutput: "roman",
      noiseReduction: true,
    });
    console.log(`  transcribed in ${Date.now() - t0}ms: ${asr.turns.length} turns, lang=${asr.languageDetected}`);
    report.languageDetected = asr.languageDetected;
    report.turnCount = asr.turns.length;
    report.durationMs = asr.durationMs;

    const { data: transcriptRow, error: tErr } = await db
      .from("transcripts")
      .insert({
        session_id: sessionId,
        version: "ai_generated",
        edit_number: 1,
        turns: asr.turns,
        raw_provider_response: asr.rawProviderResponse,
        language_detected: asr.languageDetected,
        overall_confidence: asr.overallConfidence,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(`transcript insert: ${tErr.message}`);

    await db
      .from("sessions")
      .update({ asr_provider: asr.providerName, audio_duration_ms: asr.durationMs, status: "generating_note" })
      .eq("id", sessionId);

    // 4) Call 1: SOAP note.
    const durationSeconds = Math.round((asr.durationMs || 0) / 1000);
    const userMsg = buildTranscriptUserMessage(asr.turns, durationSeconds);
    let soap;
    try {
      soap = await generateValidated(SOAPNoteZod, SOAP_SYSTEM_PROMPT, SOAP_TOOL, userMsg, "soap");
    } catch (err) {
      const reason = err instanceof NoteFailedError ? err.reason : err.message;
      await setFailure(sessionId, "note_failed", reason);
      report.noteFailure = reason;
      console.log(`  SOAP generation failed: ${reason}`);
      results.push(report);
      continue;
    }
    report.chiefComplaint = soap.chief_complaint;
    report.primaryDiagnosis = soap.assessment.primary_diagnosis;

    const { data: note, error: nErr } = await db
      .from("clinical_notes")
      .insert({
        session_id: sessionId,
        version: "ai_generated",
        edit_number: 1,
        chief_complaint: soap.chief_complaint,
        primary_diagnosis: soap.assessment.primary_diagnosis,
        differentials: soap.assessment.differential_diagnoses,
        follow_up: soap.plan.follow_up,
        no_medication: false,
        subjective: renderSection([
          ["History of Present Illness", soap.subjective.history_of_present_illness],
          ["Past Medical History", soap.subjective.past_medical_history],
          ["Medications Reported by Patient", soap.subjective.medications_reported_by_patient],
          ["Allergies", soap.subjective.allergies],
          ["Review of Systems", soap.subjective.review_of_systems],
        ]),
        objective: renderSection([
          ["Vital Signs", soap.objective.vital_signs],
          ["Physical Examination", soap.objective.physical_examination],
          ["Investigations Ordered", soap.objective.investigations_ordered],
          ["Investigations Reported", soap.objective.investigations_reported],
        ]),
        assessment: renderSection([
          ["Primary Diagnosis", soap.assessment.primary_diagnosis],
          ["Differential Diagnoses", soap.assessment.differential_diagnoses],
          ["Clinical Impression", soap.assessment.clinical_impression],
        ]),
        plan: renderSection([
          ["Treatment Plan", soap.plan.treatment_plan],
          ["Prescriptions", soap.plan.prescriptions_raw],
          ["Referrals", soap.plan.referrals],
          ["Patient Education", soap.plan.patient_education],
          ["Follow-up", soap.plan.follow_up],
        ]),
      })
      .select("id")
      .single();
    if (nErr) throw new Error(`clinical_note insert: ${nErr.message}`);
    const noteId = note.id;

    // 5) Call 2: prescriptions (only if plan mentions any).
    const rawRx = soap.plan.prescriptions_raw;
    report.prescriptions = [];
    if (rawRx && rawRx.trim() !== "") {
      try {
        const list = await generateValidated(
          PrescriptionListZod,
          PRESCRIPTION_SYSTEM_PROMPT,
          PRESCRIPTION_TOOL,
          `Extract all prescriptions from the following plan text. Drug names and dosage units must appear verbatim.\n\n<prescriptions>\n${rawRx}\n</prescriptions>`,
          "prescriptions",
        );
        if (list.prescriptions.length > 0) {
          const rows = list.prescriptions.map((item, index) => ({
            session_id: sessionId,
            note_id: noteId,
            drug_name: item.drug_name,
            dose: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            route: item.route,
            notes: item.instructions,
            sort_order: index,
          }));
          await db.from("prescriptions").insert(rows);
          report.prescriptions = list.prescriptions.map((p) => p.drug_name);
        }
      } catch (err) {
        report.prescriptionFailure = err instanceof NoteFailedError ? err.reason : err.message;
      }
    }

    await setStatus(sessionId, "draft");

    // 6) Visit summary (demo-only: normally generated post-signoff).
    try {
      const userMessage = [
        "Generate a plain-language visit summary for the patient from this finalised clinical note.",
        "",
        `Chief complaint: ${soap.chief_complaint}`,
        `Primary diagnosis: ${soap.assessment.primary_diagnosis}`,
        "",
        "Plan:",
        soap.plan.treatment_plan,
      ].join("\n");
      const summary = await generateValidated(
        VisitSummaryZod,
        VISIT_SUMMARY_SYSTEM_PROMPT,
        VISIT_SUMMARY_TOOL,
        userMessage,
        "visit_summary",
      );
      report.visitSummary = summary.diagnosis_plain;
      const content = [
        `Reason for visit: ${summary.chief_complaint_plain}`,
        `Diagnosis: ${summary.diagnosis_plain}`,
      ].join("\n\n");
      await db.from("visit_summaries").upsert(
        { session_id: sessionId, content, edited_by_doctor: false },
        { onConflict: "session_id" },
      );
    } catch (err) {
      report.summaryFailure = err instanceof NoteFailedError ? err.reason : err.message;
    }

    console.log(`  DONE — chief complaint: ${report.chiefComplaint}`);
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
    console.log(`  FAILED: ${report.error}`);
  }

  results.push(report);
}

console.log("\n\n=== SUMMARY ===");
console.log(JSON.stringify(results, null, 2));
