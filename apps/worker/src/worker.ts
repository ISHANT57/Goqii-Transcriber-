/**
 * Background worker entrypoint (PRD §5.2 / §5.5 / §6 / §7.3).
 *
 * On startup:
 *   - builds the configured ASR provider and runs its health check (§6.2.4);
 *     a failed check exits the process with a non-zero code.
 *   - starts two BullMQ Workers:
 *       1. transcribe-audio  → ASR + transcript persistence, then enqueue note.
 *       2. generate-note     → two-call SOAP + prescription note generation,
 *                              and generate-summary (patient visit summary).
 */
import "./lib/env.js"; // must be first — loads .env before any env reads
import { Queue, Worker, type Job } from "bullmq";
import {
  createASRProvider,
  ASRPermanentError,
  type ASRProvider,
  type TranscribeOptions,
  type Turn,
  SOAPNoteZod,
  PrescriptionListZod,
  VisitSummaryZod,
  type SOAPNote,
  type PrescriptionList,
  type VisitSummary,
  SOAP_TOOL,
  PRESCRIPTION_TOOL,
  VISIT_SUMMARY_TOOL,
  type LLMToolDef,
  SOAP_SYSTEM_PROMPT,
  PRESCRIPTION_SYSTEM_PROMPT,
  VISIT_SUMMARY_SYSTEM_PROMPT,
  buildRetryPrompt,
  buildTranscriptUserMessage,
} from "@gooqi/shared";
import type { ZodTypeAny } from "zod";
import { connection } from "./lib/redis.js";
import { supabase } from "./lib/supabase.js";
import { callGeminiTool, classifyGeminiError } from "./lib/gemini.js";
import { NoteFailedError } from "./lib/toolCall.js";

const AUDIO_BUCKET = "session-audio";
const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

// ─── Queues (producers) ───────────────────────────────────────────────────────
// Transient failures (Gemini 429/5xx, ASR upstream blips) now propagate straight
// through with no SDK-level auto-retry (the Anthropic SDK used to absorb these),
// so BullMQ itself must retry — 3 attempts, exponential backoff from 5s.
const generateNoteQueue = new Queue("generate-note", {
  connection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
});

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(sessionId: string, msg: string): void {
  console.log(`[session ${sessionId}] ${msg}`);
}
function logError(sessionId: string, msg: string, err?: unknown): void {
  console.error(`[session ${sessionId}] ${msg}`, err ?? "");
}

// ─── Session helpers ──────────────────────────────────────────────────────────
async function setStatus(sessionId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ status })
    .eq("id", sessionId);
  if (error) throw new Error(`failed to set status ${status}: ${error.message}`);
}

async function setFailure(
  sessionId: string,
  status: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ status, failure_reason: reason })
    .eq("id", sessionId);
  if (error) {
    logError(sessionId, `failed to record failure (${status})`, error.message);
  }
}

function durationSecondsFromTurns(
  turns: Turn[],
  audioDurationMs: number | null,
): number {
  if (typeof audioDurationMs === "number" && audioDurationMs > 0) {
    return Math.round(audioDurationMs / 1000);
  }
  const lastEnd = turns.reduce((max, t) => Math.max(max, t.endMs), 0);
  return Math.round(lastEnd / 1000);
}

// ─── Text rendering for clinical_notes columns ────────────────────────────────
function renderSection(
  fields: Array<[label: string, value: string | string[] | null | undefined]>,
): string {
  const lines: string[] = [];
  for (const [label, value] of fields) {
    if (value === null || value === undefined) continue;
    const text = Array.isArray(value) ? value.join("; ") : value;
    if (text.trim() === "") continue;
    lines.push(`${label}: ${text}`);
  }
  return lines.join("\n");
}

function renderSubjective(s: SOAPNote["subjective"]): string {
  return renderSection([
    ["History of Present Illness", s.history_of_present_illness],
    ["Past Medical History", s.past_medical_history],
    ["Medications Reported by Patient", s.medications_reported_by_patient],
    ["Allergies", s.allergies],
    ["Review of Systems", s.review_of_systems],
  ]);
}

function renderObjective(o: SOAPNote["objective"]): string {
  return renderSection([
    ["Vital Signs", o.vital_signs],
    ["Physical Examination", o.physical_examination],
    ["Investigations Ordered", o.investigations_ordered],
    ["Investigations Reported", o.investigations_reported],
  ]);
}

function renderAssessment(a: SOAPNote["assessment"]): string {
  return renderSection([
    ["Primary Diagnosis", a.primary_diagnosis],
    ["Differential Diagnoses", a.differential_diagnoses],
    ["Clinical Impression", a.clinical_impression],
  ]);
}

function renderPlan(p: SOAPNote["plan"]): string {
  return renderSection([
    ["Treatment Plan", p.treatment_plan],
    ["Prescriptions", p.prescriptions_raw],
    ["Referrals", p.referrals],
    ["Patient Education", p.patient_education],
    ["Follow-up", p.follow_up],
  ]);
}

// ─── Generic validated tool-call loop (one retry on failure) ──────────────────
/**
 * Calls Gemini forcing a function call, validates the result against `schema`,
 * and retries ONCE on validation failure or a missing function call.
 *
 * Gemini has no server-side conversation state here, so the retry re-sends the
 * original prompt with an appended correction rather than threading turns.
 *
 * Throws NoteFailedError on the non-retryable / exhausted paths. Re-throws other
 * (transient) Gemini errors so BullMQ can retry the whole job.
 */
async function generateValidated<T>(
  schema: ZodTypeAny,
  system: string,
  tool: LLMToolDef,
  userMessage: string,
  label: string,
): Promise<T> {
  let prompt = userMessage;

  for (let attempt = 0; attempt < 2; attempt++) {
    let result;
    try {
      result = await callGeminiTool({ system, tool, prompt });
    } catch (err) {
      const failed = classifyGeminiError(err);
      if (failed) throw failed;
      throw err; // transient / unexpected → BullMQ retry
    }

    // Truncated output (cut off at maxOutputTokens) is never trustworthy, even
    // when the SDK still managed to parse a (partial) function call — treat it
    // the same as no call at all: non-retryable.
    if (result.truncated) throw new NoteFailedError(`${label}_max_tokens`);

    // No usable function call.
    if (result.args == null) {
      if (attempt === 0) {
        prompt =
          `${userMessage}\n\nYou did not call the ${tool.name} function. ` +
          "You MUST respond by calling it with all required fields. Do not return free text.";
        continue;
      }
      throw new NoteFailedError(`${label}_no_tool_use`);
    }

    const parsed = schema.safeParse(result.args);
    if (parsed.success) return parsed.data as T;

    if (attempt === 0) {
      const formatted = JSON.stringify(parsed.error.format(), null, 2);
      prompt = `${userMessage}\n\n${buildRetryPrompt(formatted)}`;
      continue;
    }

    throw new NoteFailedError(
      `${label}_validation_failed: ${JSON.stringify(parsed.error.format())}`,
    );
  }

  throw new NoteFailedError(`${label}_exhausted`);
}

// ─── WORKER 1: transcribe-audio ───────────────────────────────────────────────
function makeTranscribeProcessor(provider: ASRProvider) {
  return async function processTranscribe(
    job: Job<{ sessionId: string }>,
  ): Promise<void> {
    const { sessionId } = job.data;
    log(sessionId, "transcribe-audio: start");

    try {
      // 1. status → transcribing
      await setStatus(sessionId, "transcribing");

      // 2. load session + signed URL for the audio
      const { data: session, error: sErr } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (sErr || !session) {
        throw new Error(`session not found: ${sErr?.message ?? "no row"}`);
      }

      const audioPath = `sessions/${sessionId}/audio.webm`;
      const { data: signed, error: urlErr } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS);
      if (urlErr || !signed?.signedUrl) {
        throw new Error(
          `failed to sign audio url: ${urlErr?.message ?? "no url"}`,
        );
      }

      // 3. transcription options
      const options: TranscribeOptions = {
        language: "auto",
        speakerCount: 2,
        maxSpeakers: 3,
        audioFormat: "webm",
        scriptOutput: "roman",
        noiseReduction: true,
      };

      // 4. transcribe
      const result = await provider.transcribe(signed.signedUrl, options);
      log(
        sessionId,
        `transcribed via ${result.providerName}: ${result.turns.length} turns, ${result.durationMs}ms`,
      );

      // 5. persist transcript row
      const { data: transcript, error: tErr } = await supabase
        .from("transcripts")
        .insert({
          session_id: sessionId,
          version: "ai_generated",
          edit_number: 1,
          turns: result.turns,
          raw_provider_response: result.rawProviderResponse,
          language_detected: result.languageDetected,
          overall_confidence: result.overallConfidence,
        })
        .select("id")
        .single();
      if (tErr || !transcript) {
        throw new Error(`failed to insert transcript: ${tErr?.message}`);
      }

      const { error: updErr } = await supabase
        .from("sessions")
        .update({
          asr_provider: result.providerName,
          audio_duration_ms: result.durationMs,
        })
        .eq("id", sessionId);
      if (updErr) {
        throw new Error(`failed to update session asr meta: ${updErr.message}`);
      }

      // 6. status → generating_note
      await setStatus(sessionId, "generating_note");

      // 7. enqueue note generation
      await generateNoteQueue.add("generate-note", {
        sessionId,
        transcriptId: transcript.id,
      });

      log(sessionId, "transcribe-audio: done, note job enqueued");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logError(sessionId, "transcribe-audio: failed", reason);
      await setFailure(sessionId, "transcription_failed", reason);
      // ASRPermanentError means the ASR provider itself declared the input
      // un-processable (bad format, auth, policy, duration limits, …) — retrying
      // the same audio against the same provider will fail identically every
      // time, so don't let BullMQ burn attempts/backoff on a deterministic
      // failure. Anything else (DB hiccup, network blip, unexpected error) is
      // rethrown so BullMQ can retry.
      if (err instanceof ASRPermanentError) return;
      throw err; // let BullMQ record the failure
    }
  };
}

// ─── WORKER 2a: generate-note ─────────────────────────────────────────────────
async function processGenerateNote(
  job: Job<{ sessionId: string; transcriptId: string }>,
): Promise<void> {
  const { sessionId, transcriptId } = job.data;
  log(sessionId, "generate-note: start");

  try {
    // Load transcript + session (for duration).
    const { data: transcript, error: tErr } = await supabase
      .from("transcripts")
      .select("*")
      .eq("id", transcriptId)
      .single();
    if (tErr || !transcript) {
      throw new Error(`transcript not found: ${tErr?.message ?? "no row"}`);
    }
    const { data: session } = await supabase
      .from("sessions")
      .select("audio_duration_ms")
      .eq("id", sessionId)
      .single();

    const turns = (transcript.turns ?? []) as Turn[];
    const durationSeconds = durationSecondsFromTurns(
      turns,
      session?.audio_duration_ms ?? null,
    );

    // ── CALL 1: SOAP ──────────────────────────────────────────────────────────
    const userMsg = buildTranscriptUserMessage(turns, durationSeconds);
    let soap: SOAPNote;
    try {
      soap = await generateValidated<SOAPNote>(
        SOAPNoteZod,
        SOAP_SYSTEM_PROMPT,
        SOAP_TOOL,
        userMsg,
        "soap",
      );
    } catch (err) {
      if (err instanceof NoteFailedError) {
        logError(sessionId, "generate-note: SOAP failed", err.reason);
        await setFailure(sessionId, "note_failed", err.reason);
        return;
      }
      throw err;
    }

    // Persist clinical_notes row.
    const { data: note, error: nErr } = await supabase
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
        subjective: renderSubjective(soap.subjective),
        objective: renderObjective(soap.objective),
        assessment: renderAssessment(soap.assessment),
        plan: renderPlan(soap.plan),
      })
      .select("id")
      .single();
    if (nErr || !note) {
      throw new Error(`failed to insert clinical_note: ${nErr?.message}`);
    }
    const noteId = note.id as string;
    log(sessionId, `generate-note: SOAP persisted (note ${noteId})`);

    // ── CALL 2: prescriptions ──────────────────────────────────────────────────
    const rawRx = soap.plan.prescriptions_raw;
    if (rawRx && rawRx.trim() !== "") {
      try {
        const list = await generateValidated<PrescriptionList>(
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
          const { error: rxErr } = await supabase
            .from("prescriptions")
            .insert(rows);
          if (rxErr) {
            throw new Error(`failed to insert prescriptions: ${rxErr.message}`);
          }
          log(sessionId, `generate-note: ${rows.length} prescriptions persisted`);
        } else {
          log(sessionId, "generate-note: no prescriptions extracted");
        }
      } catch (err) {
        // Keep the SOAP note; flag the extraction failure but still advance.
        const reason =
          err instanceof NoteFailedError
            ? err.reason
            : err instanceof Error
              ? err.message
              : String(err);
        logError(
          sessionId,
          "generate-note: prescription extraction failed (advancing to draft)",
          reason,
        );
        await supabase
          .from("sessions")
          .update({ failure_reason: `prescriptions_extraction_failed: ${reason}` })
          .eq("id", sessionId);
      }
    } else {
      log(sessionId, "generate-note: prescriptions_raw empty, skipping call 2");
    }

    // ── Overall success: status → draft ────────────────────────────────────────
    await setStatus(sessionId, "draft");
    log(sessionId, "generate-note: done (draft)");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logError(sessionId, "generate-note: failed", reason);
    await setFailure(sessionId, "note_failed", reason);
    throw err; // let BullMQ record the failure
  }
}

// ─── WORKER 2b: generate-summary ──────────────────────────────────────────────
function renderVisitSummary(summary: VisitSummary): string {
  const parts: string[] = [];
  parts.push(`Reason for visit: ${summary.chief_complaint_plain}`);
  parts.push(`Diagnosis: ${summary.diagnosis_plain}`);

  if (summary.medications.length > 0) {
    const meds = summary.medications
      .map((m) => `- ${m.name}${m.how_to_take ? ` — ${m.how_to_take}` : ""}`)
      .join("\n");
    parts.push(`Medicines:\n${meds}`);
  }
  if (summary.lifestyle_advice && summary.lifestyle_advice.trim() !== "") {
    parts.push(`Lifestyle advice: ${summary.lifestyle_advice}`);
  }
  if (summary.follow_up && summary.follow_up.trim() !== "") {
    parts.push(`Follow-up: ${summary.follow_up}`);
  }
  return parts.join("\n\n");
}

async function processGenerateSummary(
  job: Job<{ sessionId: string }>,
): Promise<void> {
  const { sessionId } = job.data;
  log(sessionId, "generate-summary: start");

  try {
    // Load the FINAL note (latest) + its prescriptions.
    const { data: note, error: nErr } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nErr) throw new Error(`failed to load note: ${nErr.message}`);
    if (!note) {
      log(sessionId, "generate-summary: no clinical note found, skipping");
      return;
    }

    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("note_id", note.id)
      .order("sort_order", { ascending: true });

    const rxText =
      prescriptions && prescriptions.length > 0
        ? prescriptions
            .map((p) => {
              const bits = [
                p.drug_name,
                p.dose,
                p.frequency,
                p.route,
                p.duration,
                p.notes,
              ]
                .filter((x): x is string => !!x && String(x).trim() !== "")
                .join(", ");
              return `- ${bits}`;
            })
            .join("\n")
        : "None";

    const userMessage = [
      "Generate a plain-language visit summary for the patient from this finalised clinical note.",
      "",
      `Chief complaint: ${note.chief_complaint ?? "N/A"}`,
      `Primary diagnosis: ${note.primary_diagnosis ?? "N/A"}`,
      "",
      "Assessment:",
      note.assessment ?? "N/A",
      "",
      "Plan:",
      note.plan ?? "N/A",
      "",
      `Follow-up: ${note.follow_up ?? "N/A"}`,
      "",
      "Prescriptions:",
      rxText,
    ].join("\n");

    let summary: VisitSummary;
    try {
      summary = await generateValidated<VisitSummary>(
        VisitSummaryZod,
        VISIT_SUMMARY_SYSTEM_PROMPT,
        VISIT_SUMMARY_TOOL,
        userMessage,
        "visit_summary",
      );
    } catch (err) {
      // Non-fatal: the doctor can regenerate. Log and store nothing.
      const reason =
        err instanceof NoteFailedError
          ? err.reason
          : err instanceof Error
            ? err.message
            : String(err);
      logError(sessionId, "generate-summary: failed (non-fatal)", reason);
      return;
    }

    const content = renderVisitSummary(summary);

    const { error: upErr } = await supabase
      .from("visit_summaries")
      .upsert(
        {
          session_id: sessionId,
          content,
          edited_by_doctor: false,
        },
        { onConflict: "session_id" },
      );
    if (upErr) {
      // Non-fatal per PRD — log and move on.
      logError(sessionId, "generate-summary: upsert failed (non-fatal)", upErr.message);
      return;
    }

    log(sessionId, "generate-summary: done");
  } catch (err) {
    // Non-fatal: doctor can regenerate. Do not block on it.
    const reason = err instanceof Error ? err.message : String(err);
    logError(sessionId, "generate-summary: unexpected error (non-fatal)", reason);
  }
}

// ─── Dispatcher for the generate-note queue (two job names) ───────────────────
async function processNoteQueue(job: Job): Promise<void> {
  switch (job.name) {
    case "generate-note":
      return processGenerateNote(
        job as Job<{ sessionId: string; transcriptId: string }>,
      );
    case "generate-summary":
      return processGenerateSummary(job as Job<{ sessionId: string }>);
    default:
      throw new Error(`unknown job name on generate-note queue: ${job.name}`);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const providerName = process.env.ASR_PROVIDER ?? "mock";
  const provider = createASRProvider(providerName);

  console.log(`Worker starting. ASR provider: ${provider.getName()}`);

  const healthy = await provider.getHealthCheck();
  if (!healthy) {
    console.error(
      `ASR provider "${provider.getName()}" failed health check — exiting (PRD §6.2.4).`,
    );
    process.exit(1);
  }
  console.log(`ASR provider "${provider.getName()}" healthy.`);

  const transcribeWorker = new Worker(
    "transcribe-audio",
    makeTranscribeProcessor(provider),
    { connection, concurrency: 2 },
  );

  const noteWorker = new Worker("generate-note", processNoteQueue, {
    connection,
    concurrency: 2,
  });

  for (const w of [transcribeWorker, noteWorker]) {
    w.on("failed", (job, err) => {
      console.error(
        `[worker ${w.name}] job ${job?.id ?? "?"} failed:`,
        err?.message ?? err,
      );
    });
  }

  console.log("Workers started: transcribe-audio, generate-note (concurrency 2).");

  // Graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, shutting down…`);
    await Promise.allSettled([
      transcribeWorker.close(),
      noteWorker.close(),
      generateNoteQueue.close(),
    ]);
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Worker bootstrap failed:", err);
  process.exit(1);
});
