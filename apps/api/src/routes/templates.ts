/**
 * /api/templates — doctor-saved SOAP note skeletons ("macros") for recurring
 * diagnoses, prefilled into the note editor to cut repetitive typing. No
 * PATCH: editing a template is delete + re-save from the client, which keeps
 * this route to the two operations actually needed.
 */
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";

export const templatesRouter = Router();

templatesRouter.use(requireAuth);

const TEXT_FIELDS = [
  "chief_complaint",
  "subjective",
  "objective",
  "assessment",
  "plan",
  "follow_up",
] as const;

/* -------------------------------------------------------------------------- */
/* GET /api/templates — this doctor's saved templates.                         */
/* -------------------------------------------------------------------------- */
templatesRouter.get(
  "/templates",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("note_templates")
      .select("*")
      .eq("doctor_id", req.doctorId!)
      .order("name", { ascending: true });
    if (error) {
      throw new HttpError(500, `Failed to list templates: ${error.message}`);
    }
    res.json({ templates: data ?? [] });
  }),
);

/* -------------------------------------------------------------------------- */
/* POST /api/templates — save the current note editor state as a template.     */
/* -------------------------------------------------------------------------- */
templatesRouter.post(
  "/templates",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw new HttpError(400, "Template name is required");
    }

    const fields: Record<string, unknown> = {
      doctor_id: req.doctorId!,
      name: body.name.trim(),
    };
    for (const key of TEXT_FIELDS) {
      if (typeof body[key] === "string") fields[key] = body[key];
    }

    const { data, error } = await supabase
      .from("note_templates")
      .insert(fields)
      .select("*")
      .single();
    if (error || !data) {
      throw new HttpError(500, `Failed to save template: ${error?.message}`);
    }
    res.status(201).json({ template: data });
  }),
);

/* -------------------------------------------------------------------------- */
/* DELETE /api/templates/:id                                                   */
/* -------------------------------------------------------------------------- */
templatesRouter.delete(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const { error, count } = await supabase
      .from("note_templates")
      .delete({ count: "exact" })
      .eq("id", req.params.id!)
      .eq("doctor_id", req.doctorId!);
    if (error) {
      throw new HttpError(500, `Failed to delete template: ${error.message}`);
    }
    if (!count) {
      throw new HttpError(404, "Template not found");
    }
    res.json({ deleted: true, id: req.params.id });
  }),
);
