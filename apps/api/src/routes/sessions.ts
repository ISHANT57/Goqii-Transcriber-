/**
 * /api/sessions routes — the full session lifecycle.
 *
 * All routes require auth (requireAuth) and enforce doctor ownership in code,
 * because the service-role Supabase client bypasses RLS.
 */
import { Router, type Request } from "express";
import multer from "multer";
import {
  CONSENT_TEXT_EN,
  CONSENT_TEXT_HI,
  CONSENT_TEXT_VERSION,
  type Session,
} from "@gooqi/shared";
import { supabase, AUDIO_BUCKET } from "../lib/supabase.js";
import {
  enqueueTranscription,
  enqueueSummary,
  enqueueNoteGeneration,
} from "../lib/queue.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";

export const sessionsRouter = Router();

// Every route below requires authentication.
sessionsRouter.use(requireAuth);

// Chunks are ~30s of 32kbps audio (~120KB); 10MB is generous headroom while
// still bounding worst-case per-request memory use (memoryStorage buffers the
// whole upload in the process before the handler runs).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Fetch a session and assert it is owned by the authenticated doctor (else 404). */
async function getOwnedSession(req: Request, sessionId: string): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data || data.doctor_id !== req.doctorId) {
    throw new HttpError(404, "Session not found");
  }
  return data as Session;
}

/* -------------------------------------------------------------------------- */
/* POST /api/sessions — create patient + session with hard consent gate.       */
/* -------------------------------------------------------------------------- */
sessionsRouter.post(
  "/sessions",
  asyncHandler(async (req, res) => {
    const doctorId = req.doctorId!;
    const body = req.body ?? {};
    const patientInput = body.patient ?? {};
    const consent = body.consent ?? {};

    // PRD SC-2: hard consent gate. No consent → no session.
    if (consent.agreed !== true) {
      throw new HttpError(400, "Consent is required to start a session");
    }
    if (!patientInput.name || typeof patientInput.name !== "string") {
      throw new HttpError(400, "Patient name is required");
    }

    const language: string = consent.language === "hi" ? "hi" : "en";
    const phone: string | null = patientInput.phone ?? null;

    // Upsert/create patient for this doctor. Reuse an existing record if the
    // doctor already has a patient with the same name + phone.
    let patientId: string | null = null;
    {
      let lookup = supabase
        .from("patients")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("name", patientInput.name)
        .limit(1);
      lookup = phone ? lookup.eq("phone", phone) : lookup.is("phone", null);
      const { data: existing } = await lookup;
      if (existing && existing.length > 0 && existing[0]) {
        patientId = existing[0].id as string;
      }
    }

    let patient;
    if (patientId) {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();
      patient = data;
    } else {
      const { data, error } = await supabase
        .from("patients")
        .insert({ doctor_id: doctorId, name: patientInput.name, phone })
        .select("*")
        .single();
      if (error || !data) {
        throw new HttpError(500, `Failed to create patient: ${error?.message}`);
      }
      patient = data;
    }

    const now = new Date().toISOString();
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .insert({
        doctor_id: doctorId,
        patient_id: patient.id,
        status: "recording",
        consent_logged: true,
        consent_text_version: CONSENT_TEXT_VERSION,
        consent_language: language,
        consent_timestamp: now,
        started_at: now,
      })
      .select("*")
      .single();

    if (sErr || !session) {
      throw new HttpError(500, `Failed to create session: ${sErr?.message}`);
    }

    // Immutable consent audit record (PRD SC-3). The consent_log table requires
    // doctor_id and patient_id (both NOT NULL) alongside the consent text.
    const consentText = language === "hi" ? CONSENT_TEXT_HI : CONSENT_TEXT_EN;
    const { error: clErr } = await supabase.from("consent_log").insert({
      session_id: session.id,
      doctor_id: doctorId,
      patient_id: patient.id,
      consent_text: consentText,
      consent_version: CONSENT_TEXT_VERSION,
      consent_language: language,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] ?? null,
    });
    if (clErr) {
      console.warn("[sessions] consent_log insert failed:", clErr.message);
    }

    res.status(201).json({ session, patient });
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/sessions — history list for this doctor.                           */
/* -------------------------------------------------------------------------- */
sessionsRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const doctorId = req.doctorId!;
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*, patient:patients(name, phone)")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HttpError(500, `Failed to list sessions: ${error.message}`);
    }

    const rows = sessions ?? [];

    // Attach chief_complaint / primary_diagnosis from the latest clinical note.
    const enriched = await Promise.all(
      rows.map(async (s: Record<string, unknown>) => {
        const { data: note } = await supabase
          .from("clinical_notes")
          .select("chief_complaint, primary_diagnosis")
          .eq("session_id", s.id as string)
          .order("edit_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const patient = s.patient as { name?: string; phone?: string } | null;
        return {
          ...s,
          patient_name: patient?.name ?? null,
          patient_phone: patient?.phone ?? null,
          chief_complaint: note?.chief_complaint ?? null,
          primary_diagnosis: note?.primary_diagnosis ?? null,
        };
      }),
    );

    res.json(enriched);
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/sessions/:id                                                        */
/* -------------------------------------------------------------------------- */
sessionsRouter.get(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    res.json(session);
  }),
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/sessions/:id — status transition (e.g. abandon).                  */
/* -------------------------------------------------------------------------- */
sessionsRouter.patch(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    const { status } = req.body ?? {};

    const update: Record<string, unknown> = {};
    if (status !== undefined) {
      if (status !== "abandoned") {
        throw new HttpError(400, `Unsupported status transition: ${status}`);
      }
      update.status = "abandoned";
    }

    if (Object.keys(update).length === 0) {
      res.json(session);
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .update(update)
      .eq("id", session.id)
      .select("*")
      .single();
    if (error || !data) {
      throw new HttpError(500, `Failed to update session: ${error?.message}`);
    }
    res.json(data);
  }),
);

/* -------------------------------------------------------------------------- */
/* POST /api/sessions/:id/chunks — upload one audio chunk.                      */
/* -------------------------------------------------------------------------- */
sessionsRouter.post(
  "/sessions/:id/chunks",
  upload.single("chunk"),
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    const file = req.file;
    if (!file) {
      throw new HttpError(400, "Missing chunk file");
    }
    const chunkIndex = Number(req.body?.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new HttpError(400, "chunkIndex must be a non-negative integer");
    }

    const storagePath = `sessions/${session.id}/chunks/${chunkIndex}.webm`;
    const { error: upErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype || "audio/webm",
        upsert: true,
      });
    if (upErr) {
      throw new HttpError(500, `Chunk upload failed: ${upErr.message}`);
    }

    const { error: rowErr } = await supabase.from("audio_chunks").upsert(
      {
        session_id: session.id,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        size_bytes: file.size,
      },
      { onConflict: "session_id,chunk_index" },
    );
    if (rowErr) {
      throw new HttpError(500, `Chunk record failed: ${rowErr.message}`);
    }

    const acknowledgedIndices = await getAcknowledgedIndices(session.id);
    res.json({ acknowledgedIndices });
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/sessions/:id/chunks/acknowledged — crash-recovery delta.           */
/* -------------------------------------------------------------------------- */
sessionsRouter.get(
  "/sessions/:id/chunks/acknowledged",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    const acknowledgedIndices = await getAcknowledgedIndices(session.id);
    res.json({ acknowledgedIndices });
  }),
);

/** All chunk_index values currently stored for a session, ascending. */
async function getAcknowledgedIndices(sessionId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from("audio_chunks")
    .select("chunk_index")
    .eq("session_id", sessionId)
    .order("chunk_index", { ascending: true });
  if (error) {
    throw new HttpError(500, `Failed to read chunks: ${error.message}`);
  }
  return (data ?? []).map((r) => r.chunk_index as number);
}

/* -------------------------------------------------------------------------- */
/* POST /api/sessions/:id/finalise-audio — assemble + enqueue transcription.    */
/* -------------------------------------------------------------------------- */
sessionsRouter.post(
  "/sessions/:id/finalise-audio",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);

    const { data: chunkRows, error: cErr } = await supabase
      .from("audio_chunks")
      .select("chunk_index, storage_path")
      .eq("session_id", session.id)
      .order("chunk_index", { ascending: true });
    if (cErr) {
      throw new HttpError(500, `Failed to read chunks: ${cErr.message}`);
    }
    const chunks = chunkRows ?? [];
    if (chunks.length === 0) {
      throw new HttpError(409, "No audio chunks to finalise", {
        missingIndices: [0],
      });
    }

    // Verify contiguous 0..max.
    const indices = chunks.map((c) => c.chunk_index as number);
    const max = Math.max(...indices);
    const present = new Set(indices);
    const missingIndices: number[] = [];
    for (let i = 0; i <= max; i++) {
      if (!present.has(i)) missingIndices.push(i);
    }
    if (missingIndices.length > 0) {
      throw new HttpError(409, "Audio chunks are not contiguous", {
        missingIndices,
      });
    }

    // Download each chunk in order and byte-concatenate.
    // Byte-concat is valid for a single MediaRecorder WebM/Opus stream split
    // across timeslices (no ffmpeg available in this environment).
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const { data: blob, error: dErr } = await supabase.storage
        .from(AUDIO_BUCKET)
        .download(chunk.storage_path as string);
      if (dErr || !blob) {
        throw new HttpError(
          500,
          `Failed to download chunk ${chunk.chunk_index}: ${dErr?.message}`,
        );
      }
      buffers.push(Buffer.from(await blob.arrayBuffer()));
    }
    const assembled = Buffer.concat(buffers);

    const audioPath = `sessions/${session.id}/audio.webm`;
    const { error: upErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, assembled, {
        contentType: "audio/webm",
        upsert: true,
      });
    if (upErr) {
      throw new HttpError(500, `Failed to upload assembled audio: ${upErr.message}`);
    }

    const durationMs = req.body?.audio_duration_ms ?? req.body?.audioDurationMs;
    const update: Record<string, unknown> = {
      audio_url: audioPath,
      status: "audio_uploaded",
      stopped_at: new Date().toISOString(),
    };
    if (typeof durationMs === "number") {
      update.audio_duration_ms = durationMs;
    }

    const { error: sErr } = await supabase
      .from("sessions")
      .update(update)
      .eq("id", session.id);
    if (sErr) {
      throw new HttpError(500, `Failed to update session: ${sErr.message}`);
    }

    // Enqueue transcription. If Redis is down, keep status audio_uploaded and
    // surface a warning so the client/worker can retry later.
    try {
      await enqueueTranscription(session.id);
      res.json({ status: "audio_uploaded" });
    } catch (err) {
      console.warn("[sessions] enqueueTranscription failed:", err);
      res.json({
        status: "audio_uploaded",
        warning: "Transcription could not be queued; will need a manual retry.",
      });
    }
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/sessions/:id/transcript                                            */
/* -------------------------------------------------------------------------- */
sessionsRouter.get(
  "/sessions/:id/transcript",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    const { data, error } = await supabase
      .from("transcripts")
      .select("turns, language_detected, overall_confidence")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new HttpError(500, `Failed to read transcript: ${error.message}`);
    }
    if (!data) {
      throw new HttpError(404, "No transcript yet");
    }
    res.json(data);
  }),
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/sessions/:id/transcript — save doctor edits to transcript turns. */
/* -------------------------------------------------------------------------- */
sessionsRouter.patch(
  "/sessions/:id/transcript",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    const turns = req.body?.turns;
    if (!Array.isArray(turns)) {
      throw new HttpError(400, "Body must include a `turns` array");
    }
    // Persist a doctor-edited transcript version (the AI-generated row is kept).
    const { data, error } = await supabase
      .from("transcripts")
      .insert({
        session_id: session.id,
        version: "doctor_edited",
        edit_number: 2,
        turns,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new HttpError(500, `Failed to save transcript: ${error?.message}`);
    }
    res.json(data);
  }),
);

/* -------------------------------------------------------------------------- */
/* POST /api/sessions/:id/retry — re-trigger a failed transcription or note.    */
/* -------------------------------------------------------------------------- */
sessionsRouter.post(
  "/sessions/:id/retry",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);

    if (session.status === "transcription_failed") {
      await supabase
        .from("sessions")
        .update({ status: "audio_uploaded", failure_reason: null })
        .eq("id", session.id);
      try {
        await enqueueTranscription(session.id);
      } catch (err) {
        throw new HttpError(
          503,
          `Could not enqueue transcription retry: ${(err as Error).message}`,
        );
      }
      return res.json({ status: "audio_uploaded" });
    }

    if (session.status === "note_failed") {
      // Re-run note generation against the latest transcript.
      const { data: transcript } = await supabase
        .from("transcripts")
        .select("id")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!transcript) {
        throw new HttpError(409, "No transcript available to regenerate the note");
      }
      await supabase
        .from("sessions")
        .update({ status: "generating_note", failure_reason: null })
        .eq("id", session.id);
      try {
        await enqueueNoteGeneration(session.id, transcript.id as string);
      } catch (err) {
        throw new HttpError(
          503,
          `Could not enqueue note retry: ${(err as Error).message}`,
        );
      }
      return res.json({ status: "generating_note" });
    }

    throw new HttpError(
      409,
      `Session is not in a retryable state (status: ${session.status})`,
    );
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/sessions/:id/note — latest note + prescriptions + summary.         */
/* -------------------------------------------------------------------------- */
sessionsRouter.get(
  "/sessions/:id/note",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    const note = await getLatestNote(session.id);
    if (!note) {
      throw new HttpError(404, "No clinical note yet");
    }
    const prescriptions = await getPrescriptionsForNote(note.id as string);

    // Visit summary is optional and may not exist in every environment.
    let summary: string | null = null;
    const { data: summaryRow, error: sumErr } = await supabase
      .from("visit_summaries")
      .select("content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sumErr) {
      console.warn("[sessions] visit_summaries read failed:", sumErr.message);
    } else {
      summary = summaryRow?.content ?? null;
    }

    res.json({ note, prescriptions, summary });
  }),
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/sessions/:id/note — autosave SOAP + prescriptions (draft only).   */
/* -------------------------------------------------------------------------- */
sessionsRouter.patch(
  "/sessions/:id/note",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    if (session.status !== "draft") {
      throw new HttpError(409, "Notes can only be edited while in draft status");
    }
    const note = await getLatestNote(session.id);
    if (!note) {
      throw new HttpError(404, "No clinical note to edit");
    }

    const body = req.body ?? {};
    const fields: Record<string, unknown> = { version: "doctor_edited" };
    for (const key of [
      "chief_complaint",
      "primary_diagnosis",
      "differentials",
      "follow_up",
      "no_medication",
      "subjective",
      "objective",
      "assessment",
      "plan",
    ] as const) {
      if (body[key] !== undefined) fields[key] = body[key];
    }

    const { data: updatedNote, error: nErr } = await supabase
      .from("clinical_notes")
      .update(fields)
      .eq("id", note.id as string)
      .select("*")
      .single();
    if (nErr || !updatedNote) {
      throw new HttpError(500, `Failed to update note: ${nErr?.message}`);
    }

    let prescriptions = await getPrescriptionsForNote(note.id as string);
    if (Array.isArray(body.prescriptions)) {
      prescriptions = await replacePrescriptions(
        session.id,
        note.id as string,
        body.prescriptions,
      );
    }

    res.json({ note: updatedNote, prescriptions });
  }),
);

/* -------------------------------------------------------------------------- */
/* POST /api/sessions/:id/signoff — finalise the note.                         */
/* -------------------------------------------------------------------------- */
sessionsRouter.post(
  "/sessions/:id/signoff",
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(req, req.params.id!);
    if (session.status !== "draft") {
      throw new HttpError(409, "Session must be in draft status to sign off");
    }
    const note = await getLatestNote(session.id);
    if (!note) {
      throw new HttpError(404, "No clinical note to sign off");
    }

    const body = req.body ?? {};

    // Merge any final edits supplied with the sign-off request.
    const fields: Record<string, unknown> = { version: "doctor_edited" };
    for (const key of [
      "chief_complaint",
      "primary_diagnosis",
      "differentials",
      "follow_up",
      "no_medication",
      "subjective",
      "objective",
      "assessment",
      "plan",
    ] as const) {
      if (body[key] !== undefined) fields[key] = body[key];
    }
    const { data: finalNote, error: nErr } = await supabase
      .from("clinical_notes")
      .update(fields)
      .eq("id", note.id as string)
      .select("*")
      .single();
    if (nErr || !finalNote) {
      throw new HttpError(500, `Failed to persist note: ${nErr?.message}`);
    }

    if (Array.isArray(body.prescriptions)) {
      await replacePrescriptions(session.id, note.id as string, body.prescriptions);
    }
    const prescriptions = await getPrescriptionsForNote(note.id as string);

    // Validate required fields for a final note.
    const noMedication = (finalNote.no_medication as boolean) === true;
    if (!finalNote.chief_complaint) {
      throw new HttpError(400, "Chief complaint is required to sign off");
    }
    if (!finalNote.primary_diagnosis) {
      throw new HttpError(400, "Primary diagnosis is required to sign off");
    }
    if (prescriptions.length === 0 && !noMedication) {
      throw new HttpError(
        400,
        "At least one prescription or no_medication=true is required",
      );
    }

    const { error: sErr } = await supabase
      .from("sessions")
      .update({ status: "final", finalised_at: new Date().toISOString() })
      .eq("id", session.id);
    if (sErr) {
      throw new HttpError(500, `Failed to finalise session: ${sErr.message}`);
    }

    // Enqueue visit-summary generation (worker handles the Gemini call).
    try {
      await enqueueSummary(session.id);
    } catch (err) {
      console.warn("[sessions] enqueueSummary failed:", err);
    }

    res.json({ status: "final" });
  }),
);

/* ----------------------------- helpers ------------------------------------ */

async function getLatestNote(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("session_id", sessionId)
    .order("edit_number", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new HttpError(500, `Failed to read note: ${error.message}`);
  }
  return data ?? null;
}

async function getPrescriptionsForNote(
  noteId: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("note_id", noteId)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new HttpError(500, `Failed to read prescriptions: ${error.message}`);
  }
  return data ?? [];
}

/** Replace all prescription rows for a note with the supplied list. */
async function replacePrescriptions(
  sessionId: string,
  noteId: string,
  list: unknown[],
): Promise<Record<string, unknown>[]> {
  const { error: delErr } = await supabase
    .from("prescriptions")
    .delete()
    .eq("note_id", noteId);
  if (delErr) {
    throw new HttpError(500, `Failed to clear prescriptions: ${delErr.message}`);
  }

  const rows = (list as Record<string, unknown>[])
    .filter((p) => p && typeof p.drug_name === "string" && p.drug_name)
    .map((p, i) => ({
      session_id: sessionId,
      note_id: noteId,
      drug_name: p.drug_name,
      dose: p.dose ?? null,
      frequency: p.frequency ?? null,
      duration: p.duration ?? null,
      route: p.route ?? null,
      notes: p.notes ?? null,
      sort_order: typeof p.sort_order === "number" ? p.sort_order : i,
    }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("prescriptions")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    throw new HttpError(500, `Failed to insert prescriptions: ${error.message}`);
  }
  return data ?? [];
}
