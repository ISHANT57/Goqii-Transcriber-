# Gooqi Health Transcriber

Clinical AI tool that records doctor–patient consultations, transcribes them with
speaker labels (Indian English / Hindi / Hinglish), and generates structured SOAP
notes + prescriptions for doctor review and sign-off. See `../PRD.md` for the full spec.

## Monorepo layout

```
apps/
  web/      Next.js 15 (App Router) — auth, recording, review, sign-off, history
  api/      Express REST API — sessions, chunked upload, finalise-audio, queue producer
  worker/   BullMQ worker — ASR pipeline + two-call SOAP/prescription generation
packages/
  shared/   @gooqi/shared — ASR abstraction, Zod schemas, LLM tool defs, DB types
supabase/   SQL migrations, RLS, storage bucket, combined ALL_MIGRATIONS.sql
```

## Prerequisites

- Node ≥ 20, pnpm ≥ 11
- A Supabase project (free tier is fine)
- A Gemini API key (for note generation)
- A Redis instance (e.g. Upstash free tier) for the BullMQ job queue

## 1. Install

```bash
pnpm install
```

## 2. Configure environment

Copy `.env.example` → `.env` and fill in:

| Var | Needed by | Notes |
|-----|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | all | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | api, worker | server-only; never expose to the browser |
| `GEMINI_API_KEY` | worker | required for SOAP note generation (Google Gemini) |
| `ASR_PROVIDER` | worker | `mock` for local dev; `sarvam`/`sarvam_batch`/`deepgram`/`assemblyai`/`google_chirp`/`faster_whisper`/`goqii_vertex` in prod (`sarvam_batch` adds real speaker diarization, at the cost of a much slower job-based turnaround) |
| `REDIS_URL` | api, worker | e.g. `redis://default:<pw>@<host>:<port>` |
| `API_PORT` / `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` | — | defaults: 4000 / localhost:3000 / localhost:4000 |

`apps/web/.env.local` holds the three `NEXT_PUBLIC_*` vars for the browser build
(Next.js reads its own env file).

## 3. Apply the database schema

**Easiest:** open Supabase Dashboard → **SQL Editor**, paste the contents of
`supabase/ALL_MIGRATIONS.sql`, and **Run**. This creates all tables, the
`session_status` enum, RLS policies, the append-only `consent_log` trigger, and
the private `session-audio` storage bucket.

**Or via the Supabase CLI** (needs `supabase login` + project ref + DB password):

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Also enable **Email OTP** sign-in: Dashboard → Authentication → Providers → Email
(turn on "Email OTP" / magic link).

## 4. Run everything

```bash
pnpm dev          # turbo runs web (:3000), api (:4000), worker together
```

Or individually:

```bash
pnpm --filter @gooqi/web dev
pnpm --filter @gooqi/api dev
pnpm --filter @gooqi/worker dev
```

## 5. End-to-end smoke test (with `ASR_PROVIDER=mock`)

1. Open http://localhost:3000 → redirected to `/login`. Sign in with email OTP.
2. **New Session** → enter patient name/phone → tick the consent checkbox → Start.
3. Record ~30s of audio → Stop. Chunks persist to IndexedDB then upload; on Stop
   the API assembles `audio.webm` and enqueues transcription.
4. The worker (mock ASR) produces a transcript, then Gemini generates the SOAP
   note + prescriptions. Session moves `audio_uploaded → transcribing →
   generating_note → draft`.
5. The review screen shows the transcript, editable SOAP fields, and the Rx table.
   Edit a field (autosaves every 30s), then **Sign & Finalise** → status `final`.
6. A plain-language visit summary is generated; print it (A5) from the read-only view.
7. **History** lists the session, filterable by patient.

## Architecture notes

- **ASR is swappable** behind `ASRProvider` (`packages/shared/src/asr`). Switch
  providers via the `ASR_PROVIDER` env var only — no code change (PRD §6.2, G9).
- **Note generation** is a two-call Google Gemini function-calling flow (forced
  call via `toolConfig.functionCallingConfig.mode: "ANY"`) with server-side Zod
  validation before any DB write, with a one-shot retry on validation failure
  (PRD §6.3). Model: `gemini-2.5-flash`.
- **Crash-safe recording**: 30s `MediaRecorder` chunks written to IndexedDB
  before upload, with retry/backoff, a resume banner on reload, WakeLock, and
  background-flush on tab hide (PRD §6.4).
- **Consent is a hard gate**: no consent → no session; every consent is written
  to the append-only `consent_log` (PRD SC-2/SC-3).

## Deployment (Railway + Supabase)

- **api** and **worker** deploy as two Railway services from `apps/api` and
  `apps/worker` (build `pnpm --filter @gooqi/<svc> build`, start `node dist/...`).
  Add a Railway Redis plugin and set `REDIS_URL`.
- **web** deploys to Vercel/Railway; set the `NEXT_PUBLIC_*` vars + `NEXT_PUBLIC_API_URL`.
- For DPDP compliance, set `ASR_PROVIDER=sarvam` once a DPA is signed, or
  `faster_whisper` (self-hosted) as the DPA-free fallback (PRD §8.3).
