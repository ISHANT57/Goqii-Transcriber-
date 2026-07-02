/**
 * /api/patients routes — patient directory + per-patient history.
 *
 * All routes require auth (requireAuth) and enforce doctor ownership in code,
 * because the service-role Supabase client bypasses RLS. No schema changes:
 * reads/writes the existing `patients` table (0002) and joins `sessions`.
 */
import { Router, type Request } from "express";
import type { Patient } from "@gooqi/shared";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";

export const patientsRouter = Router();

// Every route below requires authentication.
patientsRouter.use(requireAuth);

/** Fetch a patient and assert it is owned by the authenticated doctor (else 404). */
async function getOwnedPatient(req: Request, patientId: string): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (error || !data || data.doctor_id !== req.doctorId) {
    throw new HttpError(404, "Patient not found");
  }
  return data as Patient;
}

const GENDERS = new Set(["male", "female", "other", "unknown"]);

/** Read + validate the editable demographic fields from a request body. */
function readDemographics(body: Record<string, unknown>): {
  name?: string;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
} {
  const patch: {
    name?: string;
    phone?: string | null;
    dob?: string | null;
    gender?: string | null;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new HttpError(400, "Patient name must be a non-empty string");
    }
    patch.name = body.name.trim();
  }
  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") {
      throw new HttpError(400, "Phone must be a string or null");
    }
    patch.phone = body.phone ? (body.phone as string).trim() : null;
  }
  if (body.dob !== undefined) {
    if (body.dob !== null && typeof body.dob !== "string") {
      throw new HttpError(400, "Date of birth must be an ISO date string or null");
    }
    patch.dob = (body.dob as string | null) || null;
  }
  if (body.gender !== undefined) {
    if (body.gender !== null && !GENDERS.has(String(body.gender))) {
      throw new HttpError(400, "Gender must be one of male/female/other/unknown");
    }
    patch.gender = (body.gender as string | null) || null;
  }
  return patch;
}

/* -------------------------------------------------------------------------- */
/* GET /api/patients — directory for this doctor, with visit aggregates.       */
/* -------------------------------------------------------------------------- */
patientsRouter.get(
  "/patients",
  asyncHandler(async (req, res) => {
    const doctorId = req.doctorId!;

    const { data: patients, error } = await supabase
      .from("patients")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HttpError(500, `Failed to list patients: ${error.message}`);
    }

    // One query for all of this doctor's sessions, aggregated in memory — avoids
    // an N+1 count query per patient.
    const { data: sessions } = await supabase
      .from("sessions")
      .select("patient_id, started_at, created_at")
      .eq("doctor_id", doctorId);

    const agg = new Map<string, { count: number; last: string | null }>();
    for (const s of sessions ?? []) {
      const pid = (s as Record<string, unknown>).patient_id as string | null;
      if (!pid) continue;
      const when =
        ((s as Record<string, unknown>).started_at as string | null) ??
        ((s as Record<string, unknown>).created_at as string | null);
      const cur = agg.get(pid) ?? { count: 0, last: null };
      cur.count += 1;
      if (when && (!cur.last || when > cur.last)) cur.last = when;
      agg.set(pid, cur);
    }

    const rows = (patients ?? []).map((p: Record<string, unknown>) => {
      const a = agg.get(p.id as string);
      return {
        ...p,
        session_count: a?.count ?? 0,
        last_visit_at: a?.last ?? null,
      };
    });

    res.json({ patients: rows });
  }),
);

/* -------------------------------------------------------------------------- */
/* POST /api/patients — create a patient explicitly (from the directory UI).   */
/* -------------------------------------------------------------------------- */
patientsRouter.post(
  "/patients",
  asyncHandler(async (req, res) => {
    const doctorId = req.doctorId!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch = readDemographics(body);
    if (!patch.name) {
      throw new HttpError(400, "Patient name is required");
    }

    const { data, error } = await supabase
      .from("patients")
      .insert({
        doctor_id: doctorId,
        name: patch.name,
        phone: patch.phone ?? null,
        dob: patch.dob ?? null,
        gender: patch.gender ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(500, `Failed to create patient: ${error?.message}`);
    }
    res.status(201).json({ patient: data });
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/patients/:id — a single patient (ownership-checked).               */
/* -------------------------------------------------------------------------- */
patientsRouter.get(
  "/patients/:id",
  asyncHandler(async (req, res) => {
    const patient = await getOwnedPatient(req, req.params.id!);
    res.json({ patient });
  }),
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/patients/:id — update demographics (ownership-checked).          */
/* -------------------------------------------------------------------------- */
patientsRouter.patch(
  "/patients/:id",
  asyncHandler(async (req, res) => {
    await getOwnedPatient(req, req.params.id!); // ownership gate
    const patch = readDemographics((req.body ?? {}) as Record<string, unknown>);
    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "No updatable fields provided");
    }

    const { data, error } = await supabase
      .from("patients")
      .update(patch)
      .eq("id", req.params.id!)
      .eq("doctor_id", req.doctorId!) // defence-in-depth: scope the write
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(500, `Failed to update patient: ${error?.message}`);
    }
    res.json({ patient: data });
  }),
);

/* -------------------------------------------------------------------------- */
/* GET /api/patients/:id/sessions — visit history for one patient.             */
/* -------------------------------------------------------------------------- */
patientsRouter.get(
  "/patients/:id/sessions",
  asyncHandler(async (req, res) => {
    await getOwnedPatient(req, req.params.id!); // ownership gate

    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("doctor_id", req.doctorId!)
      .eq("patient_id", req.params.id!)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HttpError(500, `Failed to list patient sessions: ${error.message}`);
    }

    // Enrich with the latest clinical note summary (mirrors GET /api/sessions).
    const enriched = await Promise.all(
      (sessions ?? []).map(async (s: Record<string, unknown>) => {
        const { data: note } = await supabase
          .from("clinical_notes")
          .select("chief_complaint, primary_diagnosis")
          .eq("session_id", s.id as string)
          .order("edit_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...s,
          chief_complaint: note?.chief_complaint ?? null,
          primary_diagnosis: note?.primary_diagnosis ?? null,
        };
      }),
    );

    res.json({ sessions: enriched });
  }),
);
