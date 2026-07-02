/**
 * Authentication middleware.
 *
 * Reads `Authorization: Bearer <jwt>`, verifies it against Supabase Auth via the
 * service client, and attaches `req.doctorId` / `req.userEmail`. Also lazily
 * ensures a `doctors` row exists so foreign keys to doctor_id resolve.
 */
import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";
import { asyncHandler, HttpError } from "./error.js";

/**
 * Auth user ids for which we've already ensured a doctors row this process
 * lifetime. The row is insert-once and never deleted out from under us, so once
 * ensured it stays ensured — caching lets us skip a DB round-trip on every
 * subsequent authenticated request (including hot paths like chunk uploads and
 * 4s status polling). Bounded by the number of distinct doctors; cleared on
 * restart, which harmlessly re-ensures once per doctor.
 */
const ensuredDoctors = new Set<string>();

/**
 * Ensure a doctors row exists for this auth user.
 * Name is derived from user metadata (full_name/name) or the email local-part.
 */
export async function ensureDoctor(
  userId: string,
  email: string | undefined,
  metadata: Record<string, unknown> | undefined,
): Promise<void> {
  if (ensuredDoctors.has(userId)) return;

  const metaName =
    (metadata?.full_name as string | undefined) ??
    (metadata?.name as string | undefined);
  const fallbackName = email ? email.split("@")[0] : "Doctor";
  const name = metaName ?? fallbackName ?? "Doctor";

  // Insert only if absent; don't clobber a doctor's edited profile on every call.
  const { error } = await supabase
    .from("doctors")
    .upsert({ id: userId, name }, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    throw new HttpError(500, `Failed to ensure doctor record: ${error.message}`);
  }

  ensuredDoctors.add(userId);
}

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
      throw new HttpError(401, "Missing or malformed Authorization header");
    }
    const jwt = match[1];

    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data?.user) {
      throw new HttpError(401, "Invalid or expired token");
    }

    const user = data.user;
    req.doctorId = user.id;
    req.userEmail = user.email ?? undefined;

    await ensureDoctor(
      user.id,
      user.email ?? undefined,
      user.user_metadata as Record<string, unknown> | undefined,
    );

    next();
  },
);
