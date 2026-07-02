/**
 * Async handler wrapper + central error middleware.
 */
import type { NextFunction, Request, Response, RequestHandler } from "express";
import { MulterError } from "multer";

/** A typed HTTP error carrying a status code and optional extra payload. */
export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Wrap an async route so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Central error middleware. Returns `{ error: string, ...extra }`. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.extra ?? {}) });
    return;
  }
  if (err instanceof MulterError) {
    console.error("[error] upload rejected:", err.code, err.message);
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: `Upload rejected: ${err.message}` });
    return;
  }
  // Any other error (DB failure, unexpected exception, ...) is logged in full
  // server-side, but the client only ever sees a generic message — the raw
  // error can otherwise leak internal details (table/column names, library
  // internals) to any authenticated caller, which matters for a PHI-handling API.
  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
}
