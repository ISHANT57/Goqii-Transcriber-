/**
 * Access-token verification for the API.
 *
 * The hot path (4s status polling + chunk uploads during an active recording)
 * previously called `supabase.auth.getUser(jwt)` on EVERY request — a full
 * network round-trip to Supabase Auth (GoTrue) before any real work, plus a
 * hard availability dependency on GoTrue.
 *
 * Supabase issues standard JWTs, so we verify the signature + expiry *locally*
 * (no per-request network call) and read the identity straight from the claims:
 *
 *   - Asymmetric keys (ES256/RS256/EdDSA — the current Supabase default): the
 *     public keys are fetched once from the project's JWKS endpoint and cached
 *     by `jose` (refetched only on an unknown `kid`). No secret required.
 *   - Symmetric keys (legacy HS256): verified with SUPABASE_JWT_SECRET if set.
 *
 * If local verification isn't possible or fails for any reason, we fall back to
 * the authoritative network check, so behaviour is never worse than before and
 * misconfiguration cannot lock doctors out. A forged token still fails the
 * network check, so the fallback never weakens security.
 */
import {
  jwtVerify,
  createRemoteJWKSet,
  decodeProtectedHeader,
  type JWTPayload,
} from "jose";
import { supabase } from "./supabase.js";

export interface VerifiedIdentity {
  userId: string;
  email: string | undefined;
  metadata: Record<string, unknown> | undefined;
}

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const secretKey = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

// Remote JWKS for asymmetric verification, built once from the project URL.
// jose caches the fetched keys in-process and only refetches on an unknown kid.
const SUPABASE_URL = process.env.SUPABASE_URL;
const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

// Emit the "falling back to network verification" warning at most once so a
// misconfiguration doesn't spam the logs on every request.
let warnedFallback = false;
function warnFallbackOnce(reason: string): void {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(
    `[auth] local JWT verification unavailable (${reason}); ` +
      "falling back to network auth on some requests.",
  );
}

function identityFromClaims(payload: JWTPayload): VerifiedIdentity {
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("token missing sub claim");
  }
  return {
    userId: sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    metadata:
      payload.user_metadata && typeof payload.user_metadata === "object"
        ? (payload.user_metadata as Record<string, unknown>)
        : undefined,
  };
}

/**
 * Verify locally, selecting the key by the token's `alg` header:
 * asymmetric → JWKS public keys; HS* → shared secret. Returns null when no
 * suitable local verifier is configured; throws when a verifier exists but the
 * token is invalid.
 */
async function verifyLocally(jwt: string): Promise<VerifiedIdentity | null> {
  const { alg } = decodeProtectedHeader(jwt);
  if (!alg) return null;

  if (alg.startsWith("HS")) {
    if (!secretKey) return null;
    const { payload } = await jwtVerify(jwt, secretKey, { algorithms: [alg] });
    return identityFromClaims(payload);
  }

  // Asymmetric (ES256/RS256/EdDSA/…).
  if (!jwks) return null;
  const { payload } = await jwtVerify(jwt, jwks, { algorithms: [alg] });
  return identityFromClaims(payload);
}

/** Authoritative network verification via Supabase Auth. */
async function verifyOverNetwork(jwt: string): Promise<VerifiedIdentity | null> {
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return {
    userId: data.user.id,
    email: data.user.email ?? undefined,
    metadata: data.user.user_metadata as Record<string, unknown> | undefined,
  };
}

/**
 * Verify an access token and return the doctor's identity, or null if invalid.
 * Fast local path first; authoritative network check as fallback.
 */
export async function verifyAccessToken(
  jwt: string,
): Promise<VerifiedIdentity | null> {
  try {
    const local = await verifyLocally(jwt);
    if (local) return local;
    // No local verifier configured for this token's alg → network.
    warnFallbackOnce("no local verifier for token alg");
    return await verifyOverNetwork(jwt);
  } catch {
    // Could be a genuinely bad token OR a transient JWKS fetch issue. Defer to
    // the authoritative source rather than guessing — valid tokens normally
    // take the fast path above.
    return verifyOverNetwork(jwt);
  }
}
