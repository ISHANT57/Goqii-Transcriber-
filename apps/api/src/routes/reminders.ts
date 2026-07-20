/**
 * /api/reminders — follow-up nudges derived from `clinical_notes.follow_up_date`
 * (0016). Doctors set this date while editing/signing off a note; this endpoint
 * surfaces finalised sessions whose follow-up is due soon or overdue so the
 * doctor sees it without having to open every patient.
 *
 * No background job: "due" is just "date <= today", computed fresh on every
 * request. A scheduled job that flips a status flag at the due date would
 * duplicate that same date comparison for no behavioural difference — the only
 * place this is ever surfaced is the doctor opening the app.
 */
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";

export const remindersRouter = Router();

remindersRouter.use(requireAuth);

/** Follow-ups due within this many days from today are included (plus any overdue). */
const LOOKAHEAD_DAYS = 14;

/* -------------------------------------------------------------------------- */
/* GET /api/reminders — finalised sessions with a follow-up due soon/overdue.  */
/* -------------------------------------------------------------------------- */
remindersRouter.get(
  "/reminders",
  asyncHandler(async (req, res) => {
    const doctorId = req.doctorId!;

    const { data: sessions, error: sErr } = await supabase
      .from("sessions")
      .select("id, started_at, patient:patients(name, phone)")
      .eq("doctor_id", doctorId)
      .eq("status", "final");
    if (sErr) {
      throw new HttpError(500, `Failed to list sessions: ${sErr.message}`);
    }
    const rows = sessions ?? [];
    if (rows.length === 0) {
      res.json({ reminders: [] });
      return;
    }
    const sessionIds = rows.map((s: Record<string, unknown>) => s.id as string);

    // Latest clinical_notes row per session (mirrors getLatestNotesBySession in
    // sessions.ts): highest edit_number, then most recent, first-seen wins.
    const { data: notes, error: nErr } = await supabase
      .from("clinical_notes")
      .select("session_id, follow_up_date, edit_number, created_at")
      .in("session_id", sessionIds)
      .not("follow_up_date", "is", null)
      .order("edit_number", { ascending: false })
      .order("created_at", { ascending: false });
    if (nErr) {
      throw new HttpError(500, `Failed to load notes: ${nErr.message}`);
    }
    const followUpBySession = new Map<string, string>();
    for (const row of notes ?? []) {
      const sid = row.session_id as string;
      if (followUpBySession.has(sid)) continue;
      followUpBySession.set(sid, row.follow_up_date as string);
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + LOOKAHEAD_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const reminders = rows
      .map((s: Record<string, unknown>) => {
        const followUpDate = followUpBySession.get(s.id as string);
        if (!followUpDate) return null;
        const patient = s.patient as { name?: string; phone?: string } | null;
        return {
          session_id: s.id as string,
          patient_name: patient?.name ?? null,
          patient_phone: patient?.phone ?? null,
          follow_up_date: followUpDate,
          overdue: followUpDate < todayIso,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.follow_up_date <= cutoffIso)
      .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));

    res.json({ reminders });
  }),
);
