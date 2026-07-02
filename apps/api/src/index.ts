/**
 * @gooqi/api — Express API server for the Gooqi clinical transcriber.
 *
 * Env:
 *  - API_PORT                    (default 4000)
 *  - WEB_ORIGIN                  CORS allowed origin (default http://localhost:3000)
 *  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (see lib/supabase.ts)
 *  - REDIS_URL                   (see lib/queue.ts)
 */
import "./lib/env.js"; // must be first — loads .env before any env reads
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { sessionsRouter } from "./routes/sessions.js";
import { patientsRouter } from "./routes/patients.js";
import { doctorRouter } from "./routes/doctor.js";
import { errorMiddleware } from "./middleware/error.js";

const API_PORT = Number(process.env.API_PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = express();

// Behind a single proxy in prod (Railway/Vercel) — trust it so express-rate-limit
// and req.ip see the real client address rather than the proxy's.
app.set("trust proxy", 1);

// Baseline security headers (HSTS, X-Content-Type-Options, frameguard, etc.).
app.use(helmet());

app.use(
  cors({
    origin: WEB_ORIGIN,
    credentials: true,
  }),
);
// JSON body parser. Multipart (chunk upload) is handled per-route by multer.
app.use(express.json({ limit: "2mb" }));

// Rate limit all /api traffic. Sized generously for real clinic use — a single
// actively-recording doctor does ~30 req/min (4s status polling + 30s chunk
// uploads + autosave), and multiple doctors can share one clinic NAT IP — while
// still bounding abuse / token-guessing against the auth-gated routes.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiLimiter, sessionsRouter);
app.use("/api", apiLimiter, patientsRouter);
app.use("/api", apiLimiter, doctorRouter);

// Central error handler (must be last).
app.use(errorMiddleware);

app.listen(API_PORT, () => {
  console.log(`[api] listening on :${API_PORT} (web origin: ${WEB_ORIGIN})`);
});
