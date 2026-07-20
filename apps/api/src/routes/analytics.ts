/**
 * /api/analytics — aggregate stats over a doctor's own sessions/notes/
 * prescriptions. Read-only; no new capture, just counts over data already
 * stored. Aggregated in memory (mirrors the batching pattern in sessions.ts /
 * patients.ts) rather than a SQL view — data volume for a single doctor is
 * small enough that this is simpler and needs no migration.
 */
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

const WEEKS = 8;
const TOP_N = 5;

/** Monday-anchored start-of-week label (YYYY-MM-DD) for a date. */
function weekStart(d: Date): string {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

function topCounts(
  values: (string | null | undefined)[],
  limit: number,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const label = (v ?? "").trim();
    // Some rows store the literal string "null"/"undefined" rather than a SQL
    // NULL (same data quirk the sessions list already guards against — see
    // `clean()` in the sessions page) — treat those as missing, not a value.
    if (!label || /^(null|undefined)$/i.test(label)) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

/* -------------------------------------------------------------------------- */
/* GET /api/analytics                                                          */
/* -------------------------------------------------------------------------- */
analyticsRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const doctorId = req.doctorId!;

    const { data: sessions, error: sErr } = await supabase
      .from("sessions")
      .select("id, started_at, created_at")
      .eq("doctor_id", doctorId);
    if (sErr) {
      throw new HttpError(500, `Failed to load sessions: ${sErr.message}`);
    }
    const sessionRows = sessions ?? [];
    const sessionIds = sessionRows.map((s) => s.id as string);

    // Visits per ISO week, oldest -> newest, last WEEKS weeks.
    const now = new Date();
    const weekLabels: string[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weekLabels.push(weekStart(d));
    }
    const weekIndex = new Map(weekLabels.map((w, i) => [w, i]));
    const visitsByWeek = weekLabels.map((week) => ({ week, count: 0 }));
    for (const s of sessionRows) {
      const iso = (s.started_at as string | null) ?? (s.created_at as string | null);
      if (!iso) continue;
      const wk = weekStart(new Date(iso));
      const idx = weekIndex.get(wk);
      if (idx !== undefined) visitsByWeek[idx]!.count += 1;
    }

    let topDiagnoses: { label: string; count: number }[] = [];
    let topDrugs: { label: string; count: number }[] = [];

    if (sessionIds.length > 0) {
      const { data: notes, error: nErr } = await supabase
        .from("clinical_notes")
        .select("session_id, primary_diagnosis, edit_number, created_at")
        .in("session_id", sessionIds)
        .order("edit_number", { ascending: false })
        .order("created_at", { ascending: false });
      if (nErr) {
        throw new HttpError(500, `Failed to load notes: ${nErr.message}`);
      }
      const latestDiagnosisBySession = new Map<string, string | null>();
      for (const row of notes ?? []) {
        const sid = row.session_id as string;
        if (latestDiagnosisBySession.has(sid)) continue;
        latestDiagnosisBySession.set(sid, row.primary_diagnosis as string | null);
      }
      topDiagnoses = topCounts([...latestDiagnosisBySession.values()], TOP_N);

      const { data: prescriptions, error: rxErr } = await supabase
        .from("prescriptions")
        .select("drug_name")
        .in("session_id", sessionIds);
      if (rxErr) {
        throw new HttpError(500, `Failed to load prescriptions: ${rxErr.message}`);
      }
      topDrugs = topCounts(
        (prescriptions ?? []).map((p) => p.drug_name as string),
        TOP_N,
      );
    }

    res.json({ visitsByWeek, topDiagnoses, topDrugs });
  }),
);
