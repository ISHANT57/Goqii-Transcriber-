# Gooqi Scribe — Deployment Guide

> **Frontend → Vercel (Free Tier)** | **Backend (API + In-Process Tasks) → Render (Free Tier)**

---

## Codebase Overview

```
gooqi-medical-transcriber/         ← monorepo root (Turborepo + pnpm)
├── apps/
│   ├── web/                       ← Next.js 15 frontend  → Vercel
│   └── api/                       ← Express 4 REST API   → Render (web service)
├── packages/
│   └── shared/                    ← TypeScript types shared by all apps
├── supabase/                      ← DB migrations & RLS policies
├── render.yaml                    ← Render Blueprint (api only)
├── turbo.json                     ← Turborepo pipeline
└── .env.example                   ← All environment variables documented
```

### Service map

| Service | Runtime | Host | Role |
|---------|---------|------|------|
| `apps/web` | Next.js 15 | **Vercel** | Patient-facing UI, auth via Supabase |
| `apps/api` | Express + TypeScript | **Render** (web) | REST API, session logic + in-process transcription & note generation |
| Database | PostgreSQL | **Supabase** | All clinical data, auth, storage |

---

## Prerequisites

- [x] GitHub repo pushed: `https://github.com/ISHANT57/Goqii-Transcriber-`
- [x] Supabase project created at `https://supabase.com`
- [x] Google Gemini API key from `https://aistudio.google.com/apikey`
- [x] Render account at `https://render.com`
- [x] Vercel account at `https://vercel.com`

---

## Step 1 — Deploy Backend on Render

> Deploy **backend first** so you have the API URL to give Vercel.

### 1a. Create services via Blueprint

1. Go to **Render Dashboard → New → Blueprint**
2. Connect your GitHub repo: `ISHANT57/Goqii-Transcriber-`
3. Render auto-reads `render.yaml` and creates:
   - `gooqi-api` (web service, free tier)
4. Click **Apply** — Render queues the first deploy

> 💡 **No Redis or Background Workers required:** All transcription, SOAP note, and patient summary generation tasks run asynchronously in-process inside the Express web service.

### 1b. Set secret environment variables

After the Blueprint is applied, go to `gooqi-api` service's **Environment** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API → service_role key |
| `GEMINI_API_KEY` | `AIza...` | Google AI Studio |
| `WEB_ORIGIN` | `https://your-app.vercel.app` | Set after Vercel deploy; use `*` temporarily |
| `ASR_PROVIDER` | `mock` | Change to `sarvam`/`deepgram`/`assemblyai` when ready |

Optional ASR provider keys (only needed if `ASR_PROVIDER` is set to that specific provider):
- `SARVAM_API_KEY` (for Hindi/Hinglish ASR)
- `DEEPGRAM_API_KEY` (for fast multilingual ASR)
- `ASSEMBLYAI_API_KEY` (for AssemblyAI ASR)

### 1c. Verify API is live

After deploy completes (2–4 minutes):

```
curl https://gooqi-api.onrender.com/health
# Expected: {"ok":true}
```

Note your API URL — you'll need it in Step 2.

---

## Step 2 — Deploy Frontend on Vercel

### 2a. Import project

1. Go to **Vercel → Add New → Project**
2. Import from GitHub: `ISHANT57/Goqii-Transcriber-`
3. **Root Directory:** set to **`apps/web`** ← critical for monorepo
4. Framework preset auto-detects as **Next.js** — leave as is
5. Build & Install commands are handled by `apps/web/vercel.json` — no changes needed

### 2b. Set environment variables

In the Vercel project settings → **Environment Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon/public key) | ✅ |
| `NEXT_PUBLIC_API_URL` | `https://gooqi-api.onrender.com` | ✅ |

> Get the Supabase keys from: **Supabase Dashboard → Settings → API**

### 2c. Deploy

Click **Deploy**. Vercel builds in ~2–3 minutes.

Note your deployment URL, e.g. `https://gooqi-scribe.vercel.app`

---

## Step 3 — Wire Services Together

### 3a. Update CORS on the API

Go to **Render → gooqi-api → Environment**:

```
WEB_ORIGIN = https://your-app.vercel.app
```

Save — Render auto-redeploys. This adds your Vercel URL to the API's CORS allowlist.

### 3b. Configure Supabase Auth URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://your-app.vercel.app` |
| **Redirect URLs** | `https://your-app.vercel.app/auth/callback` |

### 3c. (Optional) Google OAuth

If you're using Google OAuth login, add your Vercel domain to the authorized origins in **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client**.

---

## Step 4 — Run Supabase Migrations

If you haven't already applied the database schema:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push
```

Or run the SQL files in `supabase/migrations/` manually in the **Supabase SQL editor**.

---

## Environment Variable Reference

### Frontend (`apps/web`) — Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=https://gooqi-api.onrender.com
```

### Backend (`apps/api`) — Render

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
WEB_ORIGIN=https://your-app.vercel.app
GEMINI_API_KEY=AIzaSy...
ASR_PROVIDER=mock                      # or: sarvam | deepgram | assemblyai

# Optional ASR keys (only if ASR_PROVIDER is set to that provider)
SARVAM_API_KEY=
DEEPGRAM_API_KEY=
ASSEMBLYAI_API_KEY=
FASTER_WHISPER_URL=
```

---

## ASR Provider Guide

`ASR_PROVIDER` controls how audio is transcribed:

| Value | Description | Best for |
|-------|-------------|----------|
| `mock` | Returns a deterministic fake transcript | Development/demo |
| `assemblyai` | AssemblyAI (English, good accuracy) | Quick production setup |
| `sarvam` | Sarvam AI (Hindi/Hinglish/regional) | Indian healthcare |
| `deepgram` | Deepgram Nova (fast, multilingual) | Real-time use cases |
| `google_chirp` | Google Cloud Speech-to-Text v2 | GCP-native deployments |
| `faster_whisper` | Self-hosted Whisper | On-prem / cost control |

---

## Deployment Checklist

```
Backend (Render)
  ☐ Blueprint applied from render.yaml
  ☐ gooqi-api: SUPABASE_URL set
  ☐ gooqi-api: SUPABASE_SERVICE_ROLE_KEY set
  ☐ gooqi-api: GEMINI_API_KEY set
  ☐ API health check passes: /health → {"ok":true}

Frontend (Vercel)
  ☐ Root directory set to apps/web
  ☐ NEXT_PUBLIC_SUPABASE_URL set
  ☐ NEXT_PUBLIC_SUPABASE_ANON_KEY set
  ☐ NEXT_PUBLIC_API_URL set to Render URL
  ☐ Deploy successful, app loads

Wiring
  ☐ WEB_ORIGIN on Render updated to Vercel URL
  ☐ Supabase Site URL updated
  ☐ Supabase Redirect URL added
  ☐ Login/signup works end to end
  ☐ New session records and processes
```

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/ISHANT57/Goqii-Transcriber-.git
cd Goqii-Transcriber-
pnpm install

# 2. Copy and fill env vars
cp .env.example .env
# Edit .env with your Supabase keys and set NEXT_PUBLIC_API_URL=http://localhost:4000

# 3. Start all services in parallel
pnpm dev

# Services start at:
#   Frontend:  http://localhost:3000
#   API:       http://localhost:4000
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `CORS error` in browser | Check `WEB_ORIGIN` on Render matches your Vercel URL exactly |
| Auth redirect loop | Update Supabase Site URL and Redirect URLs |
| `cold start` delays | Render free tier sleeps after 15 min inactivity; upgrade to Starter if needed |
| Build fails on Vercel | Ensure Root Directory is `apps/web`, not the repo root |
| `@gooqi/shared` not found | Vercel needs `installCommand` from `vercel.json` to install workspace deps |

---

## Costs (approximate)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel (Frontend) | Free (hobby) | ~$20/mo (pro) |
| Render API | Free (cold starts) | $7/mo (starter) |
| Supabase | Free (generous limits) | $25/mo (pro) |
| Gemini API | Pay-per-use | ~$0.50 per 1M tokens |

**Minimum monthly cost for production:** **$0 / month** (all run on generous free plans!)
