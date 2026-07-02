/**
 * Dummy-data seeder for a FRESH Supabase project.
 *
 * Creates password-login doctor accounts (Auth Admin API), then patients and
 * sessions spanning every status — including one fully-populated "final" session
 * (transcript → clinical note → prescriptions → visit summary → consent log) so
 * the review UI has real content to show.
 *
 * Run:  node apps/worker/scripts/seed-dummy.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 * from the monorepo-root .env.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Load the nearest .env walking up from this file.
let dir = dirname(fileURLToPath(import.meta.url));
for (let i = 0; i < 6; i++) {
  const candidate = join(dir, ".env");
  if (existsSync(candidate)) config({ path: candidate });
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PASSWORD = "Password123!";

/** Create (or reuse) an email+password doctor auth user; returns its uuid. */
async function ensureAuthUser(email) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (!error) return data.user.id;

  // Already exists → find it by paging the user list.
  if (/already|registered|exists/i.test(error.message)) {
    for (let page = 1; page <= 20; page++) {
      const { data: list, error: le } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (le) throw le;
      const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) return found.id;
      if (list.users.length < 200) break;
    }
  }
  throw error;
}

async function insert(table, row, returnId = true) {
  const q = db.from(table).insert(row);
  if (!returnId) {
    const { error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return null;
  }
  const { data, error } = await q.select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

async function main() {
  console.log(`Seeding ${URL} …`);

  // ── Doctors (password login) ────────────────────────────────────────────────
  const ashaId = await ensureAuthUser("asha@democlinic.test");
  await insert(
    "doctors",
    { id: ashaId, name: "Dr. Asha Mehta", registration_number: "MH-12345", clinic_name: "City Care Clinic" },
    false,
  ).catch((e) => { if (!/duplicate|already exists/i.test(e.message)) throw e; });

  const rajivId = await ensureAuthUser("rajiv@democlinic.test");
  await insert(
    "doctors",
    { id: rajivId, name: "Dr. Rajiv Nair", registration_number: "KA-98765", clinic_name: "Nair Family Practice" },
    false,
  ).catch((e) => { if (!/duplicate|already exists/i.test(e.message)) throw e; });

  console.log(`  doctors: asha=${ashaId} rajiv=${rajivId}`);

  // ── Patients (under Dr. Asha) ───────────────────────────────────────────────
  const ramesh = await insert("patients", { doctor_id: ashaId, name: "Ramesh Kumar", phone: "+919812345678", dob: "1979-03-15", gender: "male" });
  const sunita = await insert("patients", { doctor_id: ashaId, name: "Sunita Devi", phone: "+919823456789", dob: "1990-07-22", gender: "female" });
  const arjun = await insert("patients", { doctor_id: ashaId, name: "Arjun Singh", phone: "+919834567890", dob: "2001-11-02", gender: "male" });
  const fatima = await insert("patients", { doctor_id: ashaId, name: "Fatima Sheikh", phone: "+919845678901", dob: "1965-01-30", gender: "female" });
  console.log("  patients: 4 created");

  const consentText = "I consent to this consultation being recorded and transcribed to assist my doctor in preparing clinical notes.";

  // ── Session 1: FINAL, fully populated (showcase) ────────────────────────────
  const now = new Date();
  const s1 = await insert("sessions", {
    doctor_id: ashaId,
    patient_id: ramesh,
    status: "final",
    audio_duration_ms: 78000,
    consent_logged: true,
    consent_text_version: "v1",
    consent_language: "en",
    consent_timestamp: now.toISOString(),
    started_at: now.toISOString(),
    stopped_at: now.toISOString(),
    finalised_at: now.toISOString(),
    asr_provider: "GOQii-Vertex",
  });

  await insert("transcripts", {
    session_id: s1,
    version: "ai_generated",
    edit_number: 1,
    language_detected: "hi-Latn",
    overall_confidence: 0.79,
    turns: [
      { speaker: "doctor", startMs: 0, endMs: 4000, text: "Namaste, bataiye kya taklif ho rahi hai?", confidence: 0.82 },
      { speaker: "patient", startMs: 4000, endMs: 13000, text: "Doctor, teen din se tez bukhar hai aur sookhi khaansi bhi ho rahi hai.", confidence: 0.76 },
      { speaker: "doctor", startMs: 13000, endMs: 19000, text: "Gale mein dard ya body pain hai?", confidence: 0.8 },
      { speaker: "patient", startMs: 19000, endMs: 27000, text: "Haan, gale mein halka dard hai aur poore badan mein dard rehta hai.", confidence: 0.74 },
      { speaker: "doctor", startMs: 27000, endMs: 40000, text: "Theek hai. Main aapko bukhaar ke liye Paracetamol aur khaansi-allergy ke liye Cetirizine de raha hoon. Teen din mein aaram na aaye to dobara aana.", confidence: 0.81 },
    ],
    raw_provider_response: { note: "dummy seed data", provider: "GOQii-Vertex" },
  });

  const note1 = await insert("clinical_notes", {
    session_id: s1,
    version: "ai_generated",
    edit_number: 1,
    chief_complaint: "Fever and dry cough for 3 days",
    primary_diagnosis: "Acute viral upper respiratory tract infection",
    differentials: ["Bacterial pharyngitis", "Early pneumonia"],
    follow_up: "Review in 3 days if fever persists",
    no_medication: false,
    subjective:
      "History of Present Illness: 3 days of high-grade fever with dry cough and mild sore throat; generalised body ache.\nReview of Systems: No breathlessness, no chest pain.",
    objective: "Vital Signs: Temp 38.6°C.\nPhysical Examination: Throat mildly congested; chest clear on auscultation.",
    assessment:
      "Primary Diagnosis: Acute viral upper respiratory tract infection.\nDifferential Diagnoses: Bacterial pharyngitis; Early pneumonia.",
    plan:
      "Treatment Plan: Symptomatic management, hydration, rest.\nPrescriptions: Paracetamol 500mg TID; Cetirizine 10mg OD at night.\nFollow-up: Review in 3 days if fever persists.",
  });

  await insert("prescriptions", { session_id: s1, note_id: note1, drug_name: "Paracetamol", dose: "500 mg", frequency: "Three times a day", duration: "3 days", route: "Oral", notes: "After food", sort_order: 0 }, false);
  await insert("prescriptions", { session_id: s1, note_id: note1, drug_name: "Cetirizine", dose: "10 mg", frequency: "Once at night", duration: "5 days", route: "Oral", notes: "May cause drowsiness", sort_order: 1 }, false);

  await insert("visit_summaries", {
    session_id: s1,
    content:
      "Reason for visit: Fever and cough for 3 days.\n\nDiagnosis: A viral throat and chest infection.\n\nMedicines:\n- Paracetamol — for fever, three times a day after food, for 3 days\n- Cetirizine — one at night for cough/allergy, for 5 days\n\nLifestyle advice: Drink plenty of fluids and rest.\n\nFollow-up: Come back in 3 days if the fever does not settle.",
    edited_by_doctor: false,
  }, false);

  await insert("consent_log", {
    session_id: s1,
    doctor_id: ashaId,
    patient_id: ramesh,
    consent_text: consentText,
    consent_version: "v1",
    consent_language: "en",
  }, false);
  console.log(`  session 1 (final, full): ${s1}`);

  // ── Session 2: DRAFT (transcript + note, no prescriptions) ──────────────────
  const s2 = await insert("sessions", {
    doctor_id: ashaId, patient_id: sunita, status: "draft",
    audio_duration_ms: 42000, consent_logged: true, consent_text_version: "v1",
    consent_language: "en", consent_timestamp: now.toISOString(),
    started_at: now.toISOString(), stopped_at: now.toISOString(), asr_provider: "GOQii-Vertex",
  });
  await insert("transcripts", {
    session_id: s2, version: "ai_generated", edit_number: 1, language_detected: "hi-Latn", overall_confidence: 0.72,
    turns: [
      { speaker: "doctor", startMs: 0, endMs: 5000, text: "Kaisi tabiyat hai aaj?", confidence: 0.8 },
      { speaker: "patient", startMs: 5000, endMs: 15000, text: "Sir do din se sar dard aur chakkar aa raha hai.", confidence: 0.7 },
    ],
    raw_provider_response: { note: "dummy seed data" },
  });
  await insert("clinical_notes", {
    session_id: s2, version: "ai_generated", edit_number: 1,
    chief_complaint: "Headache and dizziness for 2 days",
    primary_diagnosis: "Tension headache", differentials: ["Migraine"], follow_up: "Return if symptoms worsen",
    no_medication: false,
    subjective: "History of Present Illness: 2 days of headache with intermittent dizziness.",
    objective: "Vital Signs: BP 128/84.", assessment: "Primary Diagnosis: Tension headache.",
    plan: "Treatment Plan: Rest, hydration, review if persistent.",
  });
  console.log(`  session 2 (draft): ${s2}`);

  // ── Sessions 3-5: in-flight / failed / fresh ────────────────────────────────
  const s3 = await insert("sessions", {
    doctor_id: ashaId, patient_id: arjun, status: "generating_note",
    audio_duration_ms: 55000, consent_logged: true, consent_text_version: "v1",
    consent_language: "en", consent_timestamp: now.toISOString(),
    started_at: now.toISOString(), stopped_at: now.toISOString(), asr_provider: "GOQii-Vertex",
  });
  console.log(`  session 3 (generating_note): ${s3}`);

  const s4 = await insert("sessions", {
    doctor_id: ashaId, patient_id: fatima, status: "transcription_failed",
    audio_duration_ms: 30000, consent_logged: true, consent_text_version: "v1",
    consent_language: "en", consent_timestamp: now.toISOString(),
    started_at: now.toISOString(), stopped_at: now.toISOString(),
    failure_reason: "Upstream 502 from ASR provider after retries", asr_provider: "GOQii-Vertex",
  });
  console.log(`  session 4 (transcription_failed): ${s4}`);

  const s5 = await insert("sessions", {
    doctor_id: ashaId, patient_id: ramesh, status: "recording",
    consent_logged: false, consent_language: "en", started_at: now.toISOString(),
  });
  console.log(`  session 5 (recording): ${s5}`);

  console.log("\n✅ Seed complete.");
  console.log("   Login (Password tab):");
  console.log("     asha@democlinic.test  /  Password123!   (has 4 patients, 5 sessions)");
  console.log("     rajiv@democlinic.test /  Password123!   (empty)");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
