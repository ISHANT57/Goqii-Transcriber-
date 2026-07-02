# Supabase — database layer

Postgres schema, RLS policies, and storage for the Gooqi clinical transcription app.

- **Project ref:** `giokilhxwatscmjcidwl`
- **Project URL:** `https://giokilhxwatscmjcidwl.supabase.co`
- **Auth:** Supabase Auth (email OTP). `doctors.id` references `auth.users(id)`.
- **Storage:** private bucket `session-audio`.

The schema is hand-maintained to match `packages/shared/src/db/types.ts`. If you
change a column here, update that file (and vice versa).

## Migration order

Migrations are applied in filename order:

| File | Contents |
| --- | --- |
| `0001_doctors.sql` | `doctors` (extends `auth.users`) |
| `0002_patients.sql` | `patients` |
| `0003_sessions.sql` | `session_status` enum + `sessions` |
| `0004_audio_chunks.sql` | `audio_chunks` |
| `0005_transcripts.sql` | `transcripts` (+ GIN index on `turns`) |
| `0006_clinical_notes.sql` | `clinical_notes` |
| `0007_prescriptions.sql` | `prescriptions` |
| `0008_visit_summaries.sql` | `visit_summaries` |
| `0009_consent_log.sql` | `consent_log` + append-only trigger |
| `0010_rls.sql` | Row Level Security policies |
| `0011_storage.sql` | `session-audio` bucket + storage policies |

Order matters: the `session_status` enum and all parent tables are created
before the children that reference them via foreign keys.

## Applying migrations

### Option A — Supabase CLI (recommended)

```bash
# From this directory (supabase/) or the monorepo root.
supabase link --project-ref giokilhxwatscmjcidwl
supabase db push
```

`supabase db push` applies any migrations under `migrations/` that have not yet
been recorded against the linked project.

For a local stack:

```bash
supabase start          # boots local Postgres, Studio, Inbucket, Storage
supabase db reset       # re-applies all migrations + seed.sql against local db
```

### Option B — Dashboard SQL editor

If you cannot use the CLI, open the project's **SQL Editor** in the Supabase
dashboard and run each migration's contents **in order** (`0001` → `0011`),
one file at a time. Run each file fully before moving to the next so foreign
keys and the enum resolve correctly.

## Security model

RLS is enabled on every data table and scoped so a doctor only sees their own
rows (`doctor_id = auth.uid()`, or via the owning session for child tables).

The API server uses the **service-role key**, which bypasses RLS. The policies
are defence-in-depth for any direct client (anon/authenticated) access through
the Supabase JS client.

`consent_log` is append-only: a `BEFORE UPDATE OR DELETE` trigger raises an
exception, so consent records can never be mutated or removed.

## Seeding

`seed.sql` is intentionally empty of real rows — `doctors` requires a matching
`auth.users` row, so we don't fabricate users. See the comments in `seed.sql`
for how to seed against a real local auth user.
