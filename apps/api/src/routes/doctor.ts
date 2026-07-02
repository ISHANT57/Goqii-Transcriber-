/**
 * /api/doctor routes — the authenticated doctor's own profile.
 *
 * Requires auth. Reads/writes the existing `doctors` table (0001); a row is
 * guaranteed to exist by ensureDoctor() in the auth middleware. No schema
 * changes. A doctor can only ever read/update their own row (id = req.doctorId).
 */
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";

export const doctorRouter = Router();

doctorRouter.use(requireAuth);

/* -------------------------------------------------------------------------- */
/* GET /api/doctor/me — the current doctor's profile.                          */
/* -------------------------------------------------------------------------- */
doctorRouter.get(
  "/doctor/me",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("id", req.doctorId!)
      .single();

    if (error || !data) {
      throw new HttpError(500, `Failed to load profile: ${error?.message}`);
    }
    res.json({ doctor: data, email: req.userEmail ?? null });
  }),
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/doctor/me — update the current doctor's profile.                 */
/* -------------------------------------------------------------------------- */
doctorRouter.patch(
  "/doctor/me",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: {
      name?: string;
      registration_number?: string | null;
      clinic_name?: string | null;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        throw new HttpError(400, "Name must be a non-empty string");
      }
      patch.name = body.name.trim();
    }
    if (body.registration_number !== undefined) {
      if (
        body.registration_number !== null &&
        typeof body.registration_number !== "string"
      ) {
        throw new HttpError(400, "registration_number must be a string or null");
      }
      patch.registration_number = body.registration_number
        ? (body.registration_number as string).trim()
        : null;
    }
    if (body.clinic_name !== undefined) {
      if (body.clinic_name !== null && typeof body.clinic_name !== "string") {
        throw new HttpError(400, "clinic_name must be a string or null");
      }
      patch.clinic_name = body.clinic_name
        ? (body.clinic_name as string).trim()
        : null;
    }

    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "No updatable fields provided");
    }

    const { data, error } = await supabase
      .from("doctors")
      .update(patch)
      .eq("id", req.doctorId!)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(500, `Failed to update profile: ${error?.message}`);
    }
    res.json({ doctor: data });
  }),
);
