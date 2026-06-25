# Gooqi Health Transcriber — PRD Multi-Agent Analysis
**Date:** 2026-06-25  
**Analysts:** 6 specialist agents (Technical Feasibility, Compliance & Legal, Product & UX, ASR & ML Quality, Business & GTM, Data Model & Architecture) + 1 synthesis agent

---

## Dimension Scorecard

| Dimension | Score | One-line Verdict |
|-----------|-------|-----------------|
| Technical Feasibility | 6.5/10 | Solid stack choices but critical reliability and safety gaps in recording, LLM enforcement, and queue design |
| Compliance & Legal | TBD | Consent model is directionally correct but English-only checkbox and missing DPA are pre-pilot blockers |
| Product & UX | TBD | Personas and workflow are realistic; review screen information density is the main UX risk |
| ASR & ML Quality | TBD | WER targets may be optimistic on real clinic audio; bake-off design is sound |
| Business & GTM | TBD | Pilot scope is appropriate; monetisation and competitive positioning not addressed |
| Data Model & Architecture | TBD | Schema is well-thought-out; append-only consent_log and RLS are correct; versioning gaps exist |

---

## Technical Feasibility — Full Analysis (Score: 6.5/10)

### Strengths
1. Stack cohesion is high: Next.js + Supabase + Vercel is a well-worn path with minimal ops burden, appropriate for a pilot-stage product.
2. ASRProvider abstraction (G9) correctly isolates the highest-uncertainty component behind an interface rather than hardcoding a vendor.
3. Supabase RLS is the right primitive for doctor-scoped data isolation without building a custom multi-tenant layer.
4. Session state machine is explicitly modelled with named statuses, reducing the risk of ghost sessions and making queue-worker logic deterministic.
5. Compliance posture is unusually thorough for v1: DPDP consent gate as hard block, append-only consent_log, Anthropic zero-data-retention option, and dual retention tiers (audio 30d / notes 7yr).
6. Prescription extraction as structured fields with an explicit 90% accuracy KPI forces measurable LLM output quality.
7. Bake-off scoring rubric with tie-break favouring data residency shows awareness that Hinglish WER alone is not the decision criterion.
8. Dual transcript storage (ai_generated + doctor_edited) satisfies NMC audit trail and enables WER measurement post-deployment.

### Critical Gaps
1. **ASRProvider interface is under-specified** — missing contract for error codes, partial-transcript events, confidence scores per segment, speaker-label schema, and retry semantics. Swappability (G9) is aspirational without this.
2. **Session state machine has no failure-state transitions** — `audio_upload_failed`, `transcription_failed`, `note_generation_failed` mentioned only as "+ failure states" with no defined recovery path or UI handling.
3. **Browser close / network drop mid-recording is unaddressed** — `MediaRecorder` produces a Blob only on `stop()`; a tab crash loses the recording entirely. No chunked upload, IndexedDB buffer, or resumable upload defined.
4. **60-minute audio in-memory is a mobile OS kill risk** — at 128 kbps the Blob is ~58 MB before upload; mobile browsers can be killed by the OS. No chunked recording strategy defined.
5. **LLM hallucination control is prompt-only** — no output schema enforcement (JSON mode / tool-calling), no field-level confidence flags, no fallback on malformed output. This is the single highest clinical-safety gap.
6. **90% prescription extraction accuracy has no measurement methodology** — no ground-truth dataset or acceptance test suite defined.
7. **No audio preprocessing before ASR** — noise suppression, voice activity detection, and sample-rate normalisation significantly affect WER in clinic environments.
8. **OQ-4 (DPA with ASR provider) has no technical contingency** — if DPA is not signed before pilot, the entire ASR pipeline is blocked with no fallback design.
9. **Auth is email+password only** — no MFA or session timeout policy; insufficient for a system holding PHI under SPDI Rules.
10. **No rate-limiting on LLM API call path** — a runaway worker or bug could exhaust Anthropic quota and block all in-flight sessions.
11. **30-second auto-save has no conflict-resolution** — if the same session is opened in two browser tabs.
12. **pg_cron cannot execute multi-step worker logic** — Supabase managed pg_cron only runs SQL; calling ASR API + polling + calling LLM requires a real worker process. BullMQ is the only viable option.

### Risk Register (Technical)

| Risk | Severity | Mitigation |
|------|----------|------------|
| MediaRecorder data loss on browser crash / mobile OS memory kill | **High** | Chunked recording (timeslice: 30s), IndexedDB local buffer, resumable multipart upload to Supabase Storage |
| LLM hallucination in drug names/dosages with no structural enforcement | **High** | Use Claude tool-calling with strict Zod/Pydantic schema for SOAPNote + Prescription; validate server-side before persisting |
| No DPA signed with ASR vendor before pilot blocks audio processing | **High** | Execute DPA as pre-pilot prerequisite; prepare self-hosted Whisper fallback (faster-whisper on Railway GPU) |
| pg_cron cannot execute the multi-step worker logic | **High** | Drop pg_cron from queue story; use BullMQ on Railway with Node.js worker |
| Hinglish WER target (≤30%) may not be achievable on uncontrolled clinic audio | **Medium** | Run bake-off on real clinic audio, not benchmark datasets; budget for human-in-the-loop transcript correction |
| Supabase Storage size limits with 60-min audio files (~55-60 MB) | **Medium** | Enable chunked multipart upload; confirm storage plan egress budget before pilot |
| DPDP-compliant consent via English-only checkbox insufficient for non-literate patients | **Medium** | Display consent in Hindi at minimum; log the language of consent presentation in consent_log |
| No MFA on doctor accounts holding PHI | **Medium** | Enable Supabase Auth TOTP (built-in) as mandatory second factor before any real patient data |
| Single LLM prompt for SOAP + prescriptions increases failure surface | **Medium** | Split into two sequential calls: SOAP note first, then prescription extraction from SOAP output |
| Audio encryption uses provider-managed keys only | **Low** | Document Supabase (AWS/GCP) encryption satisfies SPDI, or implement client-side envelope encryption |

### Recommendations (Technical)
1. Define `ASRProvider` as a TypeScript abstract class with a typed error union before any vendor integration begins.
2. Implement chunked MediaRecorder recording (`timeslice: 30000ms`) with IndexedDB local buffer and resumable upload — single most impactful reliability change.
3. Replace prompt-based hallucination guard with Claude tool-calling using strict JSON schema for `SOAPNote` and `Prescription` types.
4. Drop pg_cron from queue design; commit to BullMQ on Railway with a Node.js worker for all async jobs.
5. Add MFA (Supabase TOTP) as a hard requirement before pilot — not a v2 item.
6. Define all failure-state transitions in the state machine with explicit UI handling for each.
7. Add audio noise preprocessing (WebRTC noise suppression or RNNoise in-browser) before upload.
8. Split SOAP generation and prescription extraction into two LLM calls with separate schemas.
9. Add a `transcript_corrections_count` and `note_edit_fields` counter to sessions table for pilot analytics.
10. Define the `ASRProvider` error contract before bake-off begins so all four candidates are tested against the same error-handling surface.

---

## Compliance & Legal — Key Issues

### Critical Gaps
- **English-only consent checkbox** — patients who are not English-literate cannot meaningfully consent. Under DPDP Act 2023, consent from data principals must be "free, specific, informed, unconditional, and unambiguous." A checkbox the patient cannot read fails the "informed" criterion. Log the language of consent presentation.
- **DPA with ASR vendor is a hard pre-pilot blocker** (OQ-4) — audio containing patient voices and clinical details is personal data under DPDP. Sending it to a third-party processor without a data processing agreement is a DPDP violation.
- **7-year notes retention policy** — not grounded in a cited Indian regulation. The Clinical Establishments Act and MCI guidelines mention 3–5 years; 7 years is safe but should be documented with a legal citation.
- **Doctor "Confirm as Dr. [Name]" sign-off** — a simple button click is not a legally sufficient digital signature under IT Act 2000 Section 5. For NMC-compliant records, a more robust authentication (OTP, re-password, or DSC) is needed before production use.
- **OQ-10 (who owns the data)** is marked High but has no proposed answer. This must be in the terms of service before the pilot; without it, the clinic has no legal basis to use Gooqi.

### Recommendations
1. Add Hindi consent text for v1; log `consent_language` in `consent_log`.
2. Sign DPA with ASR vendor before processing any real patient audio.
3. Add a re-authentication step (OTP or password re-entry) to the sign-off flow before production.
4. Draft and publish a data processing agreement and privacy policy before onboarding any pilot doctor.
5. Define data ownership in terms of service: recommend "patient owns data, clinic is custodian, Gooqi is processor."

---

## Product & UX — Key Issues

### Critical Gaps
- **Review screen information overload** — showing transcript + SOAP + prescription + visit summary all at once for a doctor who has 3 minutes before the next patient is a UX failure. Needs a progressive disclosure pattern: prescription review first (highest liability), SOAP second, transcript on demand.
- **Consultation flow disruption** — the doctor must stop, reach for the device, start recording, show the consent screen to the patient, and confirm. This is 30–60 seconds of dead time in a 3–7 minute consultation. The consent UX needs to be pre-visit (patient checks in, consent captured then).
- **No "no medication" explicit flag** — `RV-5` requires "at least one prescription OR explicit 'no medication' flag" but the data model has no `no_medication` boolean on `clinical_notes`. Doctor cannot sign off a purely diagnostic session without workaround.
- **Session without a patient record** — the PRD assumes patients are pre-registered, but walk-in patients are common. The flow for creating a patient record on the fly during session setup is undefined.

### Recommendations
1. Redesign review screen with a prescription-first, sign-off-in-one-tap pattern for fast consultations.
2. Move consent capture to a pre-consultation check-in step (waiting room QR / receptionist tablet).
3. Add `no_medication: boolean` field to `clinical_notes` and sign-off acceptance criteria.
4. Define a "quick patient" flow: name + phone only, no pre-registration required.

---

## ASR & ML Quality — Key Issues

### Critical Gaps
- **WER target of ≤30% is aggressive for real clinic audio** — state-of-the-art for Hinglish in controlled settings is ~20–25% WER; uncontrolled clinic audio (AC noise, overlapping speech, patient coughing) typically degrades WER by 8–15 percentage points. The ≤30% acceptable threshold may already be at the limit of what commercial APIs can deliver without domain fine-tuning.
- **20–30 clip test set is too small** — for statistical significance across accent variety, noise conditions, and clinical vocabulary, a minimum of 100 clips (covering 5+ accents, 3+ noise levels, 4+ specialties) is needed.
- **Diarisation in Indian clinical context is harder** — Indian consultations often have attendants (3rd speaker), doctors thinking aloud, and significant overlap. DER target of ≤20% may be unachievable with 2-speaker diarisation models on 3-speaker audio.
- **OQ-5 answer** — send Roman transliteration to the LLM, not Devanagari. Claude's tokenisation is less efficient on Devanagari and its clinical knowledge is primarily in Roman script. Request the ASR provider to output Roman-script Hindi where possible; normalize at the ASRProvider layer.

### ASR Candidate Assessment
| Provider | Hinglish WER | Diarisation | Medical Vocab | Data Residency | Verdict |
|----------|-------------|-------------|---------------|----------------|---------|
| **Sarvam AI** | Best for Hinglish (purpose-built) | Limited | General | India ✓ | Likely winner if diarisation is added |
| **Augnito** | Good for medical dictation | Poor | Medical ✓ | India ✓ | Strong for prescription-heavy use |
| **Deepgram Nova-2** | Moderate Hinglish | Best | General | US ✗ | DPA complexity; strong fallback |
| **Google Chirp** | Good Hindi | Via speaker labels | General | Configurable | Solid but not differentiated |

**Likely winner:** Sarvam for overall Hinglish; Augnito as a strong contender if medical term accuracy matters more.

### Recommendations
1. Expand bake-off test set to ≥100 clips; include 3-speaker scenarios and heavy-noise conditions.
2. Send Roman transliteration to LLM; add a script normalization step at the ASRProvider layer.
3. Budget for human-corrected transcripts as a post-pilot fine-tuning dataset — this is the moat.
4. Evaluate Sarvam + Deepgram hybrid: Sarvam for Hinglish accuracy, Deepgram diarisation as a post-processing step.

---

## Business & GTM — Key Issues

### Critical Gaps
- **Monetisation is entirely absent from the PRD** — this is acceptable for a prototype PRD but the pilot doctors need to know if they are paying, and pricing signals product positioning. Recommend: free pilot, then ₹999–1499/month per doctor for solo GPs.
- **No competitive positioning vs. Augnito** — Augnito is both a bake-off candidate AND a competitor. If Augnito wins the bake-off, Gooqi would be reselling its core technology. This needs a make-vs.-buy decision documented.
- **EHR integration is deferred but is a hospital deal-breaker** — for Dr. Arjun (secondary persona, hospital specialist), the value is structured output that goes into the hospital EMR. Without FHIR export, the hospital buyer will not adopt. This non-goal is acceptable for v1 pilot with solo GPs but blocks the hospital segment.
- **WhatsApp summary delivery** — deferred to v2 but this is the single highest-impact feature for patient adoption in India. Should be v1 for the patient value prop.

### Recommendations
1. Document a simple pricing hypothesis before the pilot (even if free): ₹X/month per seat or per session.
2. Make the Augnito conflict explicit: if Augnito wins, do we license it, build around it, or use it as a baseline to beat with fine-tuning?
3. Add WhatsApp summary delivery to v1 scope (it is a one-API call with Twilio/Meta); it is the most impactful patient-facing feature.
4. Define the "training data flywheel" as a strategic asset in the PRD — the doctor-edit delta is the moat, and it should be explicitly articulated.

---

## Data Model & Architecture — Key Issues

### Critical Gaps
- **`status` as TEXT with CHECK constraint** — should be a PostgreSQL ENUM type. TEXT + CHECK requires a migration to add a new status; ENUM makes invalid transitions a DB-level error and is more readable in queries.
- **JSONB `turns` column** — querying individual turns (e.g., "find all doctor turns with low confidence") requires GIN indexing and jsonb operators. For the pilot this is fine; for production search it will be a bottleneck.
- **`clinical_notes` versioning** — the PRD stores `ai_generated` and `doctor_edited` as separate rows, but if the doctor saves multiple partial edits before sign-off, only the last `doctor_edited` row is retained. An `edit_number` column or append-only edit log is needed.
- **`prescriptions` linked to `note_id`** — if the note is regenerated (e.g., doctor triggers re-generation from edited transcript), the old prescription rows are orphaned. Should link to `session_id` with a `note_version` FK.
- **Append-only `consent_log` enforcement** — the PRD states it is append-only but doesn't specify the DB mechanism. PostgreSQL doesn't have native append-only tables; this requires a BEFORE UPDATE/DELETE trigger that raises an exception, or a dedicated role with only INSERT privilege.
- **RLS policies are not defined** — the PRD says "RLS enabled" but doesn't define the policies. Without explicit policy definitions, the implementation team will write inconsistent policies.

### Recommendations
1. Change `status` to a PostgreSQL ENUM type with a migration-friendly design pattern.
2. Add a BEFORE UPDATE/DELETE trigger on `consent_log` that raises an exception — enforce append-only at DB level, not just application level.
3. Define all RLS policies explicitly in the PRD or a companion schema spec: at minimum, `sessions`, `patients`, `transcripts`, `clinical_notes` need `USING (doctor_id = auth.uid())`.
4. Add `edit_number SERIAL` to `clinical_notes` to track multiple partial saves before sign-off.
5. Add `GIN index on transcripts(turns)` and `index on sessions(doctor_id, status, created_at)` to the schema spec.
6. Add `session_id` + `note_version` composite FK to `prescriptions` to survive note regeneration.

---

## Priority Recommendations (Top 10 — Ranked by Impact)

| # | Recommendation | Dimension | Priority |
|---|---------------|-----------|----------|
| 1 | Implement chunked MediaRecorder recording with IndexedDB buffer + resumable upload | Technical | Critical — pilot blocker |
| 2 | Replace prompt-only hallucination guard with Claude tool-calling + strict schema | Technical / ML | Critical — clinical safety |
| 3 | Sign DPA with ASR vendor before processing any real patient audio | Legal | Critical — legal blocker |
| 4 | Add Hindi consent text; log `consent_language` in `consent_log` | Legal / Product | Critical — DPDP compliance |
| 5 | Drop pg_cron from queue design; use BullMQ + Node.js worker | Technical | High — architecture fix |
| 6 | Define the full `ASRProvider` TypeScript interface with error contract | Technical | High — enables bake-off |
| 7 | Expand bake-off test set to ≥100 clips including 3-speaker + heavy-noise scenarios | ML / Quality | High — bake-off validity |
| 8 | Add MFA (Supabase TOTP) as a hard requirement before pilot | Security | High — PHI protection |
| 9 | Add `no_medication` boolean to `clinical_notes` + sign-off logic | Product | High — workflow correctness |
| 10 | Add WhatsApp summary delivery to v1 scope | Product / GTM | Medium-High — patient value |

---

## Pilot Readiness Verdict

**Verdict: NOT READY — 4 blockers must be resolved before handing to engineering.**

The PRD is well-structured and unusually compliance-aware for a v1 draft. The feature scope is right, the ASR abstraction is a sound design, and the data model is close to production-quality. However, four blockers prevent handing this to an engineering team today:

| # | Blocker | Resolution |
|---|---------|------------|
| B1 | **DPA with ASR vendor unsigned** (OQ-4) | Sign DPA or design a self-hosted fallback before any real audio is processed |
| B2 | **LLM output has no structural enforcement** | Add Claude tool-calling with JSON schema before SOAP pipeline is built |
| B3 | **Recording reliability undefined** (no chunked upload) | Define chunked recording architecture before frontend work begins |
| B4 | **ASRProvider interface unspecified** | Define the TypeScript interface before any vendor integration starts |

Once these four are resolved, the PRD is ready for a 4-week engineering sprint to a pilotable prototype.

---

*Analysis generated by 6 specialist agents + 1 synthesis agent on 2026-06-25.*
