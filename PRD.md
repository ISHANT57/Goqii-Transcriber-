# Gooqi Health Transcriber — Product Requirements Document

**Version:** 0.2 (Blockers Resolved)
**Date:** 2026-06-25
**Status:** Pilot-Ready Draft

**Changelog:** v0.2 — Fixed 4 pilot blockers: B1 (DPA requirements + faster-whisper fallback), B2 (LLM tool-calling + Zod schema enforcement), B3 (chunked recording + resumable upload), B4 (complete ASRProvider abstract class).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [User Personas](#4-user-personas)
5. [Feature Requirements](#5-feature-requirements)
   - 5.1 Session Capture
   - 5.2 Transcription Engine
   - 5.3 Structured Clinical Note
   - 5.4 Doctor Review and Sign-off
   - 5.5 Patient-Facing Visit Summary
   - 5.6 Session History
6. [Technical Architecture](#6-technical-architecture)
   - 6.1 System Overview
   - 6.2 ASR Abstraction Layer
     - 6.2.1 Error Hierarchy
     - 6.2.2 Input / Output Types
     - 6.2.3 Abstract Base Class
     - 6.2.4 Provider Factory
     - 6.2.5 FasterWhisper Fallback Stub
   - 6.3 LLM Note Generation
     - 6.3.1 Transcript Preprocessing Before LLM Calls
     - 6.3.2 TypeScript Schema Definitions
     - 6.3.3 Tool Definitions (Anthropic tool_use API)
     - 6.3.4 System Prompt — Hallucination Guard Rules
     - 6.3.5 Call Sequence and Retry Logic
     - 6.3.6 Zod Schemas (Server-Side Validation)
     - 6.3.7 Cost and Latency Estimate
   - 6.4 Frontend
   - 6.5 Infrastructure
7. [Data Model](#7-data-model)
8. [Privacy and Compliance](#8-privacy-and-compliance)
   - 8.3 Data Security
     - 8.3.1 ASR Vendor DPA Requirements
     - 8.3.2 Self-Hosted ASR Fallback
   - 8.4 Data Retention
   - 8.5 DPA Status Tracker
9. [ASR Vendor Bake-off](#9-asr-vendor-bake-off)
10. [Success Metrics and KPIs](#10-success-metrics-and-kpis)
11. [Out of Scope / Future Roadmap](#11-out-of-scope--future-roadmap)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

Gooqi Health Transcriber is a clinical AI tool that records doctor–patient consultations, transcribes them with speaker labels, and generates structured SOAP notes and prescriptions. The doctor reviews and signs off on the AI-generated output before it becomes part of the record. A plain-language visit summary is delivered to the patient.

The primary differentiator is reliable transcription of Indian clinical speech: Indian-accented English, pure Hindi, and Hinglish code-switching within a single utterance. This is the single hardest technical problem and the make-or-break quality gate.

The v1 target is a working prototype suitable for a small-clinic pilot with real doctors. It validates (a) transcription quality, (b) SOAP note usefulness, and (c) workflow fit — not scale or polish.

---

## 2. Problem Statement

Indian outpatient consultations average 2–5 minutes. The doctor simultaneously examines, diagnoses, prescribes, and writes notes — by hand, in a paper register or a fragmented EMR. The result:

- Notes are incomplete, illegible, or written after the fact from memory.
- Prescriptions are error-prone; dosage and duration are frequently missing.
- No structured data means no audit trail, no learning, no continuity of care.
- Doctors are mentally overloaded; note-writing is pure overhead.

Existing dictation tools assume American or British English. Multilingual Indian speech destroys their word-error rates. There is no production-quality tool that handles Hinglish clinical speech.

Gooqi records the encounter, transcribes it accurately, and produces a structured clinical note that the doctor can confirm in under 60 seconds — turning a 5-minute write-up into a fast review.

---

## 3. Goals and Non-Goals

### v1 Goals

| # | Goal |
|---|------|
| G1 | A doctor can capture a consultation end-to-end on a laptop or phone. |
| G2 | The system produces a speaker-labelled transcript with acceptable WER on Indian English + Hinglish. |
| G3 | A SOAP note is automatically generated from the transcript. |
| G4 | Prescription items are extracted as structured fields (drug, dose, frequency, duration). |
| G5 | The doctor can edit and sign off the note before it is finalised. |
| G6 | A plain-English visit summary is generated for the patient. |
| G7 | Patient consent is captured and logged at every session start. Consent is a hard gate — no consent, no recording. |
| G8 | Past sessions for a patient are accessible. |
| G9 | The ASR provider is swappable behind a single interface. |

### Non-Goals for v1

| # | Non-Goal |
|---|----------|
| NG1 | Real-time / streaming transcription during the encounter. |
| NG2 | Multilingual patient summaries (Hindi, Tamil, etc.). |
| NG3 | Analytics dashboards, population health, or any aggregate reporting. |
| NG4 | EHR / HIS integration (HL7, FHIR). |
| NG5 | Billing, ICD coding, or insurance claim generation. |
| NG6 | Mobile-native apps (iOS/Android). A responsive web app suffices for v1. |
| NG7 | Multi-clinic or enterprise admin. Single-practice scope. |
| NG8 | Automated finalisation without doctor sign-off. |

---

## 4. User Personas

### Persona 1 — Dr. Priya (Primary User)

| Attribute | Detail |
|-----------|--------|
| Role | MBBS GP, runs a solo outpatient clinic in Pune |
| Tech comfort | Uses WhatsApp heavily; uncomfortable with complex software |
| Consultation pace | 30–50 patients per day, 3–7 min per patient |
| Language | Speaks to patients in Marathi/Hindi, switches to English for medical terms |
| Pain point | Writes prescriptions on paper; has no structured records |
| Goal | Faster note-taking without disrupting consultation flow |
| Device | Laptop on the desk; occasionally an Android phone |

### Persona 2 — Dr. Arjun (Secondary User)

| Attribute | Detail |
|-----------|--------|
| Role | Internal medicine specialist in a small hospital, Bengaluru |
| Tech comfort | Moderate; uses an EMR but finds it rigid |
| Consultation pace | 20–30 patients per day, 5–15 min per patient |
| Language | English-dominant with Tamil/Kannada; some Hindi |
| Pain point | Wants structured output he can paste into the hospital EMR |
| Goal | Structured SOAP notes and prescription extraction |

### Persona 3 — Patient (Ravi, 48)

| Attribute | Detail |
|-----------|--------|
| Context | Visits Dr. Priya for diabetes follow-up |
| Literacy | Hindi-literate; limited English reading |
| Expectation | A simple written summary of what was discussed and what medicines to take |
| Privacy concern | Wants to know who sees the recording and that it is used only for his care |

---

## 5. Feature Requirements

### 5.1 Session Capture

**Purpose:** Record the audio of a doctor–patient consultation, tied to an authenticated doctor account and a patient record.

#### User Stories

- As a doctor, I can start a new session for a patient so the encounter is recorded and associated with that patient.
- As a doctor, I can pause a recording if I step out and resume when I return, so paused time is not transcribed.
- As a doctor, I can stop the recording to trigger processing.
- As a patient (or a doctor on behalf of the patient), I must confirm consent before recording starts.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| SC-1 | The doctor must be authenticated before starting a session. Unauthenticated users cannot reach the recording UI. |
| SC-2 | Before the microphone is activated, a consent screen is shown with a checkbox "The patient has been informed and consents to this consultation being recorded for clinical purposes." The session cannot start until the checkbox is checked and confirmed. |
| SC-3 | Consent is logged with: doctor ID, patient ID (or anonymous token for v1), timestamp, and the exact consent text version shown. |
| SC-4 | The recording UI provides Start, Pause/Resume, and Stop controls. State transitions are: idle → recording → paused → recording → stopped. |
| SC-5 | Audio is captured from the device's default microphone. The system does not require a dedicated mic — it must work on a standard laptop or Android phone in a moderately noisy room (background noise up to ~60 dB). |
| SC-6 | Paused intervals are marked in the audio metadata. Paused segments are excluded from transcription. |
| SC-7 | Audio is uploaded in 30-second chunks during recording. Each chunk is persisted to IndexedDB before any network attempt. On Stop, a `finalise-audio` call assembles the complete file server-side. Session status advances to `audio_uploaded` only after `finalise-audio` confirms all chunks were received and the assembled file is stored in Supabase Storage. A recording session that ends without a successful `finalise-audio` response remains in `recording` status and is surfaced to the doctor as resumable on next app load. |
| SC-8 | If a chunk upload fails, it is retried up to 3 times with exponential backoff (1 s / 2 s / 4 s). Failed chunks remain in IndexedDB and are re-queued automatically when the `online` event fires or when the doctor manually triggers resume. The doctor is not interrupted for individual chunk upload failures. A blocking error state is only entered if more than 3 consecutive chunks fail to upload after all retries, at which point a non-blocking banner informs the doctor that upload is paused — recording locally continues uninterrupted. |
| SC-9 | Maximum recording length is 60 minutes per session in v1. Longer sessions show a warning at 55 minutes. |
| SC-10 | The system records the patient count per doctor per day but does not transmit audio to any third party before a separate processing step is triggered. |

---

### 5.2 Transcription Engine

**Purpose:** Convert recorded audio to a speaker-labelled, turn-by-turn transcript that accurately represents Indian English, Hindi, and Hinglish code-switching.

#### User Stories

- As a doctor, after stopping the recording, I can trigger transcription and receive the result within a reasonable time.
- As a developer, I can swap the ASR provider by changing a config value, without changing any other code.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| TR-1 | Transcription is triggered automatically after audio upload confirms success (post-encounter, not real-time). |
| TR-2 | The system calls the ASR provider through a single interface (ASRProvider — see Architecture §6.2). No ASR vendor SDK is called directly from application code. |
| TR-3 | The transcript is structured as an ordered list of turns: { speaker: "doctor" | "patient" | "other" | "unknown", start_ms: int, end_ms: int, text: string }. |
| TR-4 | Speaker diarisation labels at minimum two speakers (Doctor, Patient). A third label other covers nurse/attendant. unknown is used when diarisation confidence is below threshold. |
| TR-5 | The system accepts transcripts partially in Hindi/Devanagari script or fully in Roman transliteration, depending on the provider's output. For v1, the note-generation LLM prompt is designed to handle both. |
| TR-6 | Transcription of a 10-minute audio file completes within 3 minutes (wall clock, p95). |
| TR-7 | Word Error Rate target on a held-out Hinglish clinical test set: WER ≤ 30% (acceptable), ≤ 20% (good). This is measured during the ASR bake-off (§9) to select the provider. |
| TR-8 | If transcription fails (provider error, timeout), the session status is set to transcription_failed and the doctor is notified. Manual re-trigger is available. |
| TR-9 | The raw transcript is stored as-is from the provider (provider-native format) alongside the normalised turn-list format. Both are retained for debugging. |
| TR-10 | The active ASR provider is a config key (ASR_PROVIDER=sarvam|augnito|deepgram|google_chirp|faster_whisper). Changing it requires no code change. |

---

### 5.3 Structured Clinical Note

**Purpose:** From the transcript, auto-generate a SOAP note, extract structured prescription fields, and capture chief complaint, likely diagnosis, and follow-up.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| CN-1 | Note generation is triggered automatically after a successful transcription. |
| CN-2 | The SOAP note has four sections: Subjective, Objective, Assessment, Plan. Each section is a separate editable field, not one blob. |
| CN-3 | The Subjective section contains: chief complaint, history of present illness, relevant past history, allergies (if mentioned). |
| CN-4 | The Objective section contains: vitals mentioned in the transcript (BP, temp, HR, SpO2, weight), physical examination findings. Fields not mentioned in the transcript are left blank, not hallucinated. |
| CN-5 | The Assessment section contains: likely diagnosis (primary and differential if stated), severity. |
| CN-6 | The Plan section contains: investigations ordered, referrals, lifestyle advice, prescriptions summary, follow-up instruction. |
| CN-7 | Prescription extraction produces a structured list. Each item: { drug_name: string, dose: string, frequency: string, duration: string, route: string, notes: string }. Missing fields are null, not guessed. |
| CN-8 | Chief complaint, primary diagnosis, and follow-up date/instruction are each a separate top-level field in the note, distinct from the SOAP prose. |
| CN-9 | The LLM prompt instructs the model explicitly: do not invent clinical information not present in the transcript; prefer leaving a field blank over guessing. |
| CN-10 | Note generation for a 10-minute transcript completes within 60 seconds (p95). |
| CN-11 | If note generation fails, the session status is note_failed. The doctor is notified and can trigger a retry. |
| CN-12 | The note is saved with status draft — it is never final until the doctor signs off (§5.4). |

---

### 5.4 Doctor Review and Sign-off

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| RV-1 | The review screen shows: the transcript (speaker-labelled turns), the SOAP note fields, prescription table, and patient summary draft — all on one screen or in adjacent tabs. |
| RV-2 | Every SOAP field, every prescription row field, chief complaint, diagnosis, and follow-up are individually editable inline. |
| RV-3 | The doctor can correct speaker labels in the transcript. |
| RV-4 | The doctor can edit transcript turn text. These edits are saved as transcript_corrections. |
| RV-5 | A "Sign & Finalise" button is shown only when all required fields are present: chief complaint, primary diagnosis, at least one prescription or explicit "no medication" flag. |
| RV-6 | On sign-off, the doctor must re-authenticate (at minimum, click a "Confirm as Dr. [Name]" button). |
| RV-7 | After sign-off, the note status becomes final. No further edits to clinical content are allowed. |
| RV-8 | The system stores: the original AI-generated note, the original AI-generated transcript, the final edited note, the final edited transcript, timestamp of sign-off, and doctor ID. |
| RV-9 | The patient-facing summary (§5.5) is generated from the finalised note, not the draft. |
| RV-10 | If a doctor closes the browser mid-review, the draft is auto-saved every 30 seconds. On return, the last saved draft is restored. |

---

### 5.5 Patient-Facing Visit Summary

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| PS-1 | The summary is generated automatically after the doctor signs off. |
| PS-2 | The summary contains: patient name, visit date, doctor name, chief complaint (plain language), diagnosis (plain language), medication list, lifestyle advice, follow-up instruction. |
| PS-3 | Language is plain English, avoiding medical jargon. |
| PS-4 | The summary is printable as a single A5 page. |
| PS-5 | Multilingual output is NOT in scope for v1. |
| PS-6 | The doctor can edit the summary before it is shown to the patient. |
| PS-7 | The summary is stored against the session. |

---

### 5.6 Session History

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| SH-1 | The history view shows a list of sessions for the logged-in doctor, sorted by date descending. |
| SH-2 | The list can be filtered by patient name or patient phone number. |
| SH-3 | Each row shows: date, patient name, chief complaint, diagnosis, session status. |
| SH-4 | Clicking a session opens a read-only view of the transcript, SOAP note, prescription, and visit summary. |
| SH-5 | Sessions in non-final status are clearly labelled with their status. |
| SH-6 | No analytics, charts, or aggregate views are shown in v1. |
| SH-7 | The history is scoped to the logged-in doctor. No cross-doctor visibility in v1. |

---

## 6. Technical Architecture

### 6.1 System Overview

```
Browser (Web App)
    |
    |  HTTPS
    v
API Server (Node.js / Python FastAPI)
    |
    +---> Auth Service (JWT, sessions)
    |
    +---> Object Storage (audio files) [Supabase Storage]
    |
    +---> BullMQ Worker (Railway) <--- triggers on audio upload
    |           |
    |           +---> ASR Worker ---------> ASR Provider (swappable via ASR_PROVIDER env)
    |           |
    |           +---> Note Generation Worker --> Anthropic Claude API (tool-calling)
    |
    +---> PostgreSQL (all structured data — Supabase)
```

### 6.2 ASR Abstraction Layer

The ASR abstraction layer provides a concrete, swappable interface (G9) between the transcription pipeline and any upstream speech recognition provider. All provider implementations extend `ASRProvider` — an abstract class rather than a bare interface — so that retry logic, error normalisation, and health-check semantics are enforced uniformly without duplication in each provider.

---

#### 6.2.1 Error Hierarchy

```typescript
export enum ASRErrorCode {
  TIMEOUT        = "TIMEOUT",
  RATE_LIMIT     = "RATE_LIMIT",
  AUTH_FAILURE   = "AUTH_FAILURE",
  INVALID_AUDIO  = "INVALID_AUDIO",
  CONTENT_POLICY = "CONTENT_POLICY",
  UNKNOWN        = "UNKNOWN",
}

export class ASRError extends Error {
  constructor(
    message: string,
    public readonly code: ASRErrorCode,
    public readonly providerName: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ASRError";
  }
}

/**
 * Transient failures — safe to retry.
 * Includes: network timeouts, upstream 5xx responses, rate-limit (429).
 */
export class ASRTransientError extends ASRError {
  constructor(
    message: string,
    code: ASRErrorCode.TIMEOUT | ASRErrorCode.RATE_LIMIT | ASRErrorCode.UNKNOWN,
    providerName: string,
  ) {
    super(message, code, providerName, /* retryable */ true);
    this.name = "ASRTransientError";
  }
}

/**
 * Permanent failures — must NOT be retried; surface immediately to caller.
 * Includes: invalid audio format, authentication failure, content policy rejection.
 */
export class ASRPermanentError extends ASRError {
  constructor(
    message: string,
    code: ASRErrorCode.AUTH_FAILURE | ASRErrorCode.INVALID_AUDIO | ASRErrorCode.CONTENT_POLICY,
    providerName: string,
  ) {
    super(message, code, providerName, /* retryable */ false);
    this.name = "ASRPermanentError";
  }
}
```

---

#### 6.2.2 Input / Output Types

```typescript
/** Transcription request parameters passed by the worker to the provider. */
export interface TranscribeOptions {
  /** BCP-47 language code, or "auto" for provider-side detection. */
  language: "hi" | "en-IN" | "auto";

  /** Expected number of distinct speakers (hint only; provider may ignore). Default: 2. */
  speakerCount?: number;

  /** Hard upper bound for diarisation. Provider must not return more than this many speaker labels. Default: 3. */
  maxSpeakers?: number;

  /** Encoding of the audio payload. Provider must reject formats it cannot handle via ASRPermanentError. */
  audioFormat: "wav" | "mp3" | "webm" | "ogg";

  /**
   * Desired script for the primary `text` field on each Turn.
   * "roman"     — Latin-script transliteration (Hinglish-safe; default).
   * "devanagari"— Devanagari Unicode.
   * "auto"      — provider chooses; the detected script is recorded in languageDetected.
   * See Section 6.1 (B2 fix) for full script-handling policy.
   */
  scriptOutput: "roman" | "devanagari" | "auto";

  /**
   * Hint to the provider to apply noise reduction before recognition.
   * Providers that do not support this MUST silently ignore the flag, not throw.
   * Default: true.
   */
  noiseReduction?: boolean;
}

/** Word-level timestamp, emitted when the provider supports forced alignment. */
export interface Word {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0–1
}

/** A single speaker turn within a transcript. */
export interface Turn {
  /** Role label from diarisation. "unknown" when speaker count == 1 or diarisation failed. */
  speaker: "doctor" | "patient" | "other" | "unknown";

  startMs: number;
  endMs: number;

  /** Transcript text in the script requested via TranscribeOptions.scriptOutput (default: Roman). */
  text: string;

  /** Devanagari form of the same text, populated only when the provider returns dual-script output. */
  textOriginalScript?: string;

  /** Per-turn ASR confidence in [0, 1]. Required; providers must supply a value (may be estimated). */
  confidence: number;

  /** Word-level detail; omit when provider does not support it rather than returning empty array. */
  words?: Word[];
}

/** Normalised transcription result returned by every ASRProvider implementation. */
export interface TranscriptResult {
  turns: Turn[];

  /** BCP-47 code for the language the provider actually recognised, e.g. "hi", "en-IN", "hi-Latn". */
  languageDetected: string;

  /**
   * Aggregate confidence for the whole transcript.
   * If the provider reports a document-level score, use that.
   * Otherwise compute as the duration-weighted mean of Turn.confidence values.
   * Range [0, 1].
   */
  overallConfidence: number;

  /** Total audio length in milliseconds as reported by the provider. */
  durationMs: number;

  /** Wall-clock time from doTranscribe() call to resolved Promise, in milliseconds. */
  processingTimeMs: number;

  /** Name of the provider that produced this result, identical to ASRProvider.getName(). */
  providerName: string;

  /**
   * Unmodified provider API response, preserved for debugging and audit.
   * Must not be forwarded to the LLM or stored in the patient record.
   */
  rawProviderResponse: unknown;
}
```

---

#### 6.2.3 Abstract Base Class

```typescript
const ASR_MAX_RETRIES     = 2;
const ASR_BACKOFF_BASE_MS = 5_000; // 5 s; attempt n waits n * 5 s

/**
 * All ASR providers extend this class.
 *
 * Subclasses implement only `doTranscribe()`, `getName()`, and `getHealthCheck()`.
 * The public `transcribe()` method wraps `doTranscribe()` with:
 *   - exponential backoff retry on ASRTransientError (up to ASR_MAX_RETRIES retries)
 *   - immediate re-throw on ASRPermanentError
 *   - processingTimeMs measurement
 */
export abstract class ASRProvider {
  /**
   * Human-readable provider identifier used in structured logs and metrics.
   * Examples: "AssemblyAI", "FasterWhisper-Railway", "Sarvam".
   */
  abstract getName(): string;

  /**
   * Called once at worker startup before the job queue begins consuming work.
   * Must return true within 10 s or the worker exits with a non-zero code.
   * Implementations should perform the cheapest possible reachability check
   * (e.g. a credentials ping, not a full transcription).
   */
  abstract getHealthCheck(): Promise<boolean>;

  /**
   * Provider-specific transcription logic. Implementations must:
   *   - Throw ASRTransientError for retriable conditions (timeout, 429, 5xx).
   *   - Throw ASRPermanentError for non-retriable conditions (401, bad format, policy).
   *   - Never swallow errors silently.
   */
  protected abstract doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult>;

  /**
   * Public entry point.  Wraps doTranscribe() with retry and timing.
   *
   * Retry policy:
   *   - Up to ASR_MAX_RETRIES (2) additional attempts after the first failure.
   *   - Only ASRTransientError triggers a retry; ASRPermanentError is re-thrown immediately.
   *   - Backoff: attempt 1 → 5 s, attempt 2 → 10 s.
   *   - If all attempts are exhausted the final ASRTransientError is re-thrown unchanged.
   */
  async transcribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> {
    const start = Date.now();
    let lastError: ASRError | undefined;

    for (let attempt = 0; attempt <= ASR_MAX_RETRIES; attempt++) {
      try {
        const result = await this.doTranscribe(audioUrl, options);
        // Stamp processingTimeMs here so subclasses need not track it themselves.
        return { ...result, processingTimeMs: Date.now() - start };
      } catch (err) {
        if (err instanceof ASRPermanentError) {
          throw err; // never retry
        }
        if (err instanceof ASRTransientError) {
          lastError = err;
          if (attempt < ASR_MAX_RETRIES) {
            const backoffMs = (attempt + 1) * ASR_BACKOFF_BASE_MS;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
        } else {
          // Unexpected error type — wrap and surface immediately without retry.
          throw new ASRTransientError(
            err instanceof Error ? err.message : String(err),
            ASRErrorCode.UNKNOWN,
            this.getName(),
          );
        }
      }
    }

    throw lastError!;
  }
}
```

---

#### 6.2.4 Provider Factory

The active provider is instantiated **once** at worker startup. Concrete provider classes are registered in `createASRProvider`; adding a new provider requires only a new `case` branch with no changes to the pipeline.

```typescript
/**
 * Instantiates the ASR provider configured via the ASR_PROVIDER environment variable.
 *
 * Valid values: "assemblyai" | "fasterwhisper" | "sarvam"
 * Throws a hard error at startup if the value is unrecognised, so
 * misconfigured deployments fail fast before any job is consumed.
 *
 * @param name  Value of process.env.ASR_PROVIDER (passed in by the worker entrypoint).
 * @returns     A concrete ASRProvider instance ready for health-check and use.
 */
export function createASRProvider(name: string): ASRProvider;
```

Implementation lives in `src/asr/factory.ts`. The worker entrypoint calls:

```typescript
const provider = createASRProvider(process.env.ASR_PROVIDER ?? "assemblyai");
const healthy  = await provider.getHealthCheck();
if (!healthy) process.exit(1);
```

---

#### 6.2.5 FasterWhisper Fallback Stub

`FasterWhisperASRProvider` is a concrete subclass of `ASRProvider` targeting a self-hosted [faster-whisper](https://github.com/SYSTRAN/faster-whisper) inference server deployed on Railway's GPU tier (see Section 8.5 — Data Processing Addendum). It is available as a DPA-compliant fallback when AssemblyAI is unavailable or when audio must not leave the EU data region. It exposes the identical `ASRProvider` interface; no changes to the worker pipeline are required to switch.

```typescript
// src/asr/providers/fasterwhisper.ts
export class FasterWhisperASRProvider extends ASRProvider {
  getName(): string { return "FasterWhisper-Railway"; }
  async getHealthCheck(): Promise<boolean> { /* HTTP GET /health on Railway service */ }
  protected async doTranscribe(
    audioUrl: string,
    options: TranscribeOptions,
  ): Promise<TranscriptResult> { /* POST /transcribe with multipart/form-data */ }
}
```

---

### 6.3 LLM Note Generation

#### Overview

Note generation is implemented as a **two-call architecture** using the Anthropic Claude API with strict tool-calling (function calling). Structural enforcement is the primary clinical safety mechanism — the model is never permitted to return free text for clinical fields. Zod validation runs server-side on every tool call result before any data is persisted.

**Why two calls instead of one:**
- A single prompt that simultaneously generates narrative SOAP content and extracts structured prescription data has a larger hallucination surface. Splitting the task reduces the token budget each call must reason over.
- Prescription extraction runs against the already-generated SOAP plan section (not the raw transcript), which is shorter, cleaner, and already filtered of noise. This makes schema conformance easier to enforce and cheaper to retry.
- If prescription extraction fails validation, only Call 2 is retried — the SOAP note is not discarded.

---

#### 6.3.1 Transcript Preprocessing Before LLM Calls

The ASR provider layer normalises all transcript output to **Roman-script transliteration** before any text is sent to the LLM. Devanagari script is never forwarded to Claude.

**Rationale:**
- Claude's tokeniser is trained primarily on Roman-script corpora. Devanagari characters tokenise as multi-byte sequences, increasing token consumption 3–4× for equivalent content.
- Clinical drug names, dosage units, and anatomical terminology are primarily encoded in Claude's weights as Roman-script strings. Roman-script input improves recall accuracy for these terms.
- Transliteration is lossless for the clinical content this system cares about.

The ASRProvider must expose a `getTranscriptRoman(): TranscriptTurn[]` method. Downstream workers always call this method, never the raw Devanagari accessor.

---

#### 6.3.2 TypeScript Schema Definitions

```typescript
// ── SOAP Note Schema ─────────────────────────────────────────────────────────

interface SOAPNoteSchema {
  chief_complaint: string;                  // required; verbatim from transcript
  subjective: {
    history_of_present_illness: string;     // required
    past_medical_history: string | null;
    medications_reported_by_patient: string | null;
    allergies: string | null;
    review_of_systems: string | null;
  };
  objective: {
    vital_signs: string | null;             // e.g. "BP 120/80 mmHg"
    physical_examination: string | null;
    investigations_ordered: string | null;
    investigations_reported: string | null;
  };
  assessment: {
    primary_diagnosis: string;              // required; verbatim or direct inference
    differential_diagnoses: string[] | null;
    clinical_impression: string | null;
  };
  plan: {
    treatment_plan: string;                 // required
    prescriptions_raw: string | null;       // free-text plan section; input for Call 2
    referrals: string | null;
    patient_education: string | null;
    follow_up: string | null;
  };
  note_language: "en" | "hi-roman" | "mixed";
  transcript_duration_seconds: number;
}

// ── Prescription List Schema ──────────────────────────────────────────────────

interface PrescriptionItem {
  drug_name: string;           // required; must appear verbatim in source text
  dosage: string | null;       // must appear verbatim; do not convert units
  frequency: string | null;    // e.g. "twice daily", "BD", "TDS"
  route: string | null;        // e.g. "oral", "topical"
  duration: string | null;     // e.g. "5 days", "1 week"
  instructions: string | null; // e.g. "after meals", "with water"
  quantity: string | null;
}

interface PrescriptionListSchema {
  prescriptions: PrescriptionItem[];        // empty array if none found; never null
  extraction_notes: string | null;          // optional model commentary on ambiguities
}
```

---

#### 6.3.3 Tool Definitions (Anthropic tool_use API)

Two tools are registered on every request. The model is called with `tool_choice: { type: "any" }` on Call 1 and Call 2 respectively, forcing a tool call — free-text responses are not accepted.

```typescript
const SOAP_TOOL: Anthropic.Tool = {
  name: "generate_soap_note",
  description:
    "Generate a structured SOAP clinical note from the provided transcript. " +
    "All fields must be grounded in the transcript. Return null for any field " +
    "not mentioned. Do not infer, expand, or guess.",
  input_schema: {
    type: "object",
    properties: {
      /* mirrors SOAPNoteSchema above — full JSON Schema definition */
    },
    required: [
      "chief_complaint",
      "subjective",
      "objective",
      "assessment",
      "plan",
      "note_language",
      "transcript_duration_seconds",
    ],
    additionalProperties: false,
  },
};

const PRESCRIPTION_TOOL: Anthropic.Tool = {
  name: "extract_prescriptions",
  description:
    "Extract all prescriptions from the provided plan text. " +
    "Drug names and dosage units must appear verbatim in the input text. " +
    "Do not expand abbreviations or convert units. " +
    "Return an empty array if no prescriptions are present.",
  input_schema: {
    type: "object",
    properties: {
      /* mirrors PrescriptionListSchema above */
    },
    required: ["prescriptions"],
    additionalProperties: false,
  },
};
```

---

#### 6.3.4 System Prompt — Hallucination Guard Rules

The following rules are injected verbatim into the system prompt for both calls. They are in addition to schema enforcement and are not negotiable:

```
You are a clinical documentation assistant. You must call the provided tool.
You must never return free text as a substitute for a tool call.

Hallucination prevention rules — these are absolute constraints:
1. If a field is not mentioned in the transcript, return null. Do not infer or guess.
2. Drug names must appear verbatim in the transcript. Do not expand abbreviations.
3. Dosage units must appear verbatim in the transcript. Do not convert units
   (e.g. if the transcript says "500 mg", do not write "0.5 g").
4. Do not synthesise clinical information from general medical knowledge.
   Only reflect what the doctor and patient said.
5. chief_complaint and primary_diagnosis must be direct quotes or minimal
   paraphrases grounded in the transcript. Do not produce ICD codes unless
   the doctor stated one explicitly.
```

---

#### 6.3.5 Call Sequence and Retry Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Note Generation Worker                          │
│                                                                         │
│  1. Fetch transcript (Roman-script)                                     │
│                                                                         │
│  ── CALL 1: generate_soap_note ──────────────────────────────────────   │
│  2. POST /messages with transcript + system prompt + SOAP_TOOL          │
│     tool_choice: { type: "any" }                                        │
│  3. Model returns tool_use block → extract input arguments              │
│  4. Zod validate SOAPNoteSchema                                         │
│     ├─ PASS → persist soap_note, continue to Call 2                    │
│     └─ FAIL → append Zod error to prompt, retry once                   │
│               ├─ PASS on retry → persist, continue                     │
│               └─ FAIL on retry → mark note_failed, alert doctor, stop  │
│                                                                         │
│  ── CALL 2: extract_prescriptions ──────────────────────────────────   │
│  5. POST /messages with plan.prescriptions_raw from Call 1 output       │
│     + system prompt + PRESCRIPTION_TOOL                                 │
│     tool_choice: { type: "any" }                                        │
│  6. Model returns tool_use block → extract input arguments              │
│  7. Zod validate PrescriptionListSchema                                 │
│     ├─ PASS → persist prescriptions, mark note_complete                │
│     └─ FAIL → append Zod error to prompt, retry once                   │
│               ├─ PASS on retry → persist, mark note_complete           │
│               └─ FAIL on retry → persist soap_note without             │
│                                  prescriptions, mark                   │
│                                  prescriptions_extraction_failed,      │
│                                  alert doctor                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Retry prompt construction (both calls):** When a validation failure triggers a retry, the worker appends the following block to the user turn before resubmitting:

```
The previous tool call failed server-side schema validation with the following errors:
<validation_errors>
{zodError.format()}
</validation_errors>
Please call the tool again. Fix only the fields listed above. Do not change
fields that were already valid. All hallucination prevention rules still apply.
```

**Non-retryable errors:** HTTP 5xx from the Anthropic API, context-length exceeded, and `stop_reason: "max_tokens"` are not retried — they are immediately classified as `note_failed`.

---

#### 6.3.6 Zod Schemas (Server-Side Validation)

```typescript
import { z } from "zod";

const PrescriptionItemSchema = z.object({
  drug_name: z.string().min(1),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  route: z.string().nullable(),
  duration: z.string().nullable(),
  instructions: z.string().nullable(),
  quantity: z.string().nullable(),
});

const PrescriptionListZod = z.object({
  prescriptions: z.array(PrescriptionItemSchema),
  extraction_notes: z.string().nullable().optional(),
});

const SOAPNoteZod = z.object({
  chief_complaint: z.string().min(1),
  subjective: z.object({
    history_of_present_illness: z.string().min(1),
    past_medical_history: z.string().nullable(),
    medications_reported_by_patient: z.string().nullable(),
    allergies: z.string().nullable(),
    review_of_systems: z.string().nullable(),
  }),
  objective: z.object({
    vital_signs: z.string().nullable(),
    physical_examination: z.string().nullable(),
    investigations_ordered: z.string().nullable(),
    investigations_reported: z.string().nullable(),
  }),
  assessment: z.object({
    primary_diagnosis: z.string().min(1),
    differential_diagnoses: z.array(z.string()).nullable(),
    clinical_impression: z.string().nullable(),
  }),
  plan: z.object({
    treatment_plan: z.string().min(1),
    prescriptions_raw: z.string().nullable(),
    referrals: z.string().nullable(),
    patient_education: z.string().nullable(),
    follow_up: z.string().nullable(),
  }),
  note_language: z.enum(["en", "hi-roman", "mixed"]),
  transcript_duration_seconds: z.number().nonnegative(),
});

// Usage after extracting tool_use.input:
const result = SOAPNoteZod.safeParse(toolUseBlock.input);
if (!result.success) {
  // retry path — pass result.error.format() back in the prompt
}
```

Validation is performed **before** any write to the database. The Zod parse result is never trusted to be implicitly correct; `safeParse` is used (not `parse`) so validation errors are always caught and handled explicitly.

---

#### 6.3.7 Cost and Latency Estimate

For a typical 10-minute Hinglish consultation:

| Parameter | Estimate |
|---|---|
| Transcript length | 1,500–2,000 words ≈ 2,000–2,500 tokens |
| System prompt (shared) | ~500 tokens |
| Call 1 input tokens | ~3,000–3,200 tokens |
| Call 1 output (SOAP tool call) | ~600–700 tokens |
| Call 2 input tokens (plan section only) | ~400–600 tokens |
| Call 2 output (prescription list) | ~100–200 tokens |
| **Total per session (no retry)** | **~4,100–4,700 tokens input / ~700–900 tokens output** |

At `claude-sonnet-4-6` pricing ($3.00 / MTok input, $15.00 / MTok output as of the PRD date):

- Input cost: ~$0.012–0.014
- Output cost: ~$0.011–0.013
- **Estimated total: $0.010–0.015 per session**

A single retry on either call adds at most ~1,500 tokens input and is not expected to occur in more than 5% of sessions once the system prompt is tuned against production transcripts. At scale (1,000 sessions/day), expected daily LLM spend is approximately $10–15 before retry overhead.

Latency: Claude Sonnet typically returns tool call responses in 3–8 seconds for this token volume. Two sequential calls therefore add 6–16 seconds to the post-session processing pipeline. This is acceptable given that note generation is asynchronous and not on the critical path of the consultation itself.

---

### 6.4 Frontend

- **Framework:** Next.js (React)
- **UI:** Tailwind CSS + shadcn/ui components
- **Auth:** Supabase Auth (email+password for v1)

#### Recording Architecture — Chunked, Crash-Safe

Recording uses the browser `MediaRecorder` API (WebM/Opus) with a mandatory `timeslice` of `30000` ms. This causes `ondataavailable` to fire every 30 seconds, producing a stream of bounded chunks rather than a single in-memory Blob that grows unbounded for the duration of a consultation.

**IndexedDB local buffer (crash-safe)**

Every chunk emitted by `ondataavailable` is written synchronously to IndexedDB before any network call is attempted. The library used is `idb-keyval` (or `Dexie.js` for projects that need a richer query surface). Each record is keyed by a composite structure:

```
{ sessionId: string, chunkIndex: number, timestamp: number, uploaded: boolean }
```

IndexedDB is the source of truth for in-progress recordings. The in-memory `Blob` is never the canonical store — it is discarded after each successful IndexedDB write. This means a browser crash, mobile OS memory kill (SIGKILL on Android/iOS), or sudden tab close loses at most the partial chunk currently being accumulated (up to 30 seconds of audio), not the entire session.

**WakeLock and background-flush**

During an active recording session:

- `navigator.wakeLock.request('screen')` is acquired (Screen Wake Lock API) to prevent device sleep on Android Chrome, which would suspend the `MediaRecorder` and corrupt the stream.
- A `visibilitychange` listener calls `mediaRecorder.requestData()` immediately when the tab is backgrounded. This forces `ondataavailable` to fire early, flushing the partial current chunk to IndexedDB before the OS suspends the tab.

#### Resumable Upload Protocol

On each `ondataavailable` event (after IndexedDB write succeeds), the chunk is uploaded:

```
POST /api/sessions/{id}/chunks
Body: { chunkIndex: number, totalChunksEstimate: number, blob: Blob }
```

The API server writes the chunk to Supabase Storage at the path:

```
sessions/{sessionId}/chunks/{chunkIndex}.webm
```

The server response includes an `acknowledgedIndices` array — the set of chunk indices it has already received and persisted. The client marks those indices as `uploaded: true` in IndexedDB.

**Finalise call**

When the doctor presses Stop, `mediaRecorder.stop()` is called. After the final `ondataavailable` chunk is written and uploaded, the client issues:

```
POST /api/sessions/{id}/finalise-audio
```

The server concatenates all chunks stored in Supabase Storage (using ffmpeg for a proper WebM remux, or ordered byte-concatenation as a fallback for spec-compliant WebM streams) and writes the result to:

```
sessions/{sessionId}/audio.webm
```

Session status remains `recording` throughout chunk upload and only advances to `audio_uploaded` after `finalise-audio` returns `200` confirming all chunks were received and the assembled file is intact. The final per-chunk objects in Supabase Storage are retained for 48 hours then purged by a scheduled function.

**Chunk upload retry**

Each chunk upload is retried up to 3 times with exponential backoff (1 s, 2 s, 4 s) before being marked failed in IndexedDB. The doctor is not interrupted for individual chunk failures. If more than 3 consecutive chunks fail (indicating a sustained connectivity loss), a non-blocking error banner is shown: "Upload paused — check your connection. Recording continues locally." Chunks remain in IndexedDB and are re-queued automatically when connectivity is restored (detected via the `online` event).

#### Crash Recovery Flow

On every app load (including hard reload and return from background), the client queries IndexedDB for any session record where `uploaded: false` chunks exist:

1. If found, a persistent "Resume upload" banner is rendered at the top of the UI, showing the session ID, patient reference, and how many chunks are pending.
2. The doctor chooses **Resume** or **Discard**.
3. On **Resume**: the client calls `GET /api/sessions/{id}/chunks/acknowledged` — the server returns the indices it already holds. Only the delta (unacknowledged chunk indices still in IndexedDB) is re-uploaded. This prevents duplicate chunk writes on the server.
4. On **Discard**: all IndexedDB records for that session are deleted and the session is marked `abandoned` via `PATCH /api/sessions/{id}`.

If the app is reloaded mid-recording (e.g. browser crash), the partially-recorded session is never silently lost — it surfaces immediately on next open.

#### Updated Acceptance Criteria (SC-7 and SC-8)

These supersede the criteria stated in Section 5.1 for SC-7 and SC-8.

**SC-7 (revised):** Audio is uploaded in 30-second chunks during recording. Each chunk is persisted to IndexedDB before any network attempt. On Stop, a `finalise-audio` call assembles the complete file server-side. Session status advances to `audio_uploaded` only after `finalise-audio` confirms all chunks were received and the assembled file is stored in Supabase Storage. A recording session that ends without a successful `finalise-audio` response remains in `recording` status and is surfaced to the doctor as resumable on next app load.

**SC-8 (revised):** If a chunk upload fails, it is retried up to 3 times with exponential backoff (1 s / 2 s / 4 s). Failed chunks remain in IndexedDB and are re-queued automatically when the `online` event fires or when the doctor manually triggers resume. The doctor is not interrupted for individual chunk upload failures. A blocking error state is only entered if more than 3 consecutive chunks fail to upload after all retries, at which point a non-blocking banner informs the doctor that upload is paused — recording locally continues uninterrupted.

---

### 6.5 Infrastructure

| Component | Technology | Rationale |
|---|---|---|
| **Job queue / worker** | **BullMQ on Railway (Node.js worker process)** | `pg_cron` executes plain SQL on a schedule and cannot orchestrate multi-step async work. The ASR → LLM → structured-output pipeline requires a real worker process with retry state, backoff, progress events, and dead-letter handling. BullMQ on Railway provides all of this with Redis-backed durability; `pg_cron` is retained only for lightweight database maintenance tasks (e.g. expiring old sessions). |
| API server | Node.js / Express on Railway | Stateless; scales horizontally. |
| Database | Supabase (Postgres + pgvector) | Managed Postgres with RLS; pgvector for future semantic search. |
| File storage | Supabase Storage (S3-compatible) | Audio blobs stored with a 30-day retention policy; presigned URLs passed to the ASR worker. |
| Auth | Supabase Auth (OTP / magic-link) | No passwords stored; OTP aligns with clinical staff login UX. |

---

## 7. Data Model

### 7.1 Core Tables

```sql
-- Doctors (extends Supabase auth.users)
CREATE TABLE doctors (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  registration_number TEXT,
  clinic_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Patients
CREATE TABLE patients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctors(id),
  name        TEXT NOT NULL,
  phone       TEXT,
  dob         DATE,
  gender      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Sessions
CREATE TYPE session_status AS ENUM (
  'recording', 'audio_uploaded',
  'transcribing', 'transcription_failed',
  'generating_note', 'note_failed',
  'draft', 'final'
);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID NOT NULL REFERENCES doctors(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  status          session_status NOT NULL DEFAULT 'recording',
  audio_url       TEXT,
  audio_duration_ms INT,
  consent_logged  BOOLEAN NOT NULL DEFAULT false,
  consent_text_version TEXT,
  consent_language TEXT NOT NULL DEFAULT 'en',
  consent_timestamp TIMESTAMPTZ,
  started_at      TIMESTAMPTZ DEFAULT now(),
  stopped_at      TIMESTAMPTZ,
  finalised_at    TIMESTAMPTZ,
  asr_provider    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Audio chunks (for resumable upload tracking)
CREATE TABLE audio_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id),
  chunk_index INT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes  INT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, chunk_index)
);

-- Transcripts
CREATE TABLE transcripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id),
  version     TEXT NOT NULL CHECK (version IN ('ai_generated', 'doctor_edited')),
  edit_number INT NOT NULL DEFAULT 1,
  turns       JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_transcripts_turns_gin ON transcripts USING GIN (turns);

-- Clinical Notes
CREATE TABLE clinical_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES sessions(id),
  version             TEXT NOT NULL CHECK (version IN ('ai_generated', 'doctor_edited')),
  edit_number         INT NOT NULL DEFAULT 1,
  chief_complaint     TEXT,
  primary_diagnosis   TEXT,
  differentials       TEXT[],
  follow_up           TEXT,
  no_medication       BOOLEAN NOT NULL DEFAULT false,
  subjective          TEXT,
  objective           TEXT,
  assessment          TEXT,
  plan                TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Prescriptions (linked to session + note version, survives note regeneration)
CREATE TABLE prescriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id),
  note_id     UUID NOT NULL REFERENCES clinical_notes(id),
  drug_name   TEXT NOT NULL,
  dose        TEXT,
  frequency   TEXT,
  duration    TEXT,
  route       TEXT,
  notes       TEXT,
  sort_order  INT
);

-- Visit Summaries
CREATE TABLE visit_summaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id),
  content     TEXT NOT NULL,
  edited_by_doctor BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Consent Log (append-only, enforced by trigger)
CREATE TABLE consent_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES sessions(id),
  doctor_id           UUID NOT NULL REFERENCES doctors(id),
  patient_id          UUID NOT NULL REFERENCES patients(id),
  consent_text        TEXT NOT NULL,
  consent_version     TEXT NOT NULL,
  consent_language    TEXT NOT NULL DEFAULT 'en',
  consented_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address          INET,
  user_agent          TEXT
);

-- Trigger: enforce append-only on consent_log
CREATE OR REPLACE FUNCTION consent_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'consent_log is append-only: UPDATE and DELETE are not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consent_log_immutable
  BEFORE UPDATE OR DELETE ON consent_log
  FOR EACH ROW EXECUTE FUNCTION consent_log_immutable();
```

### 7.2 Row-Level Security Policies

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctor_own_patients ON patients
  USING (doctor_id = auth.uid());

CREATE POLICY doctor_own_sessions ON sessions
  USING (doctor_id = auth.uid());

CREATE POLICY doctor_own_transcripts ON transcripts
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

CREATE POLICY doctor_own_notes ON clinical_notes
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

CREATE POLICY doctor_own_prescriptions ON prescriptions
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

CREATE POLICY doctor_own_summaries ON visit_summaries
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));

CREATE POLICY doctor_own_chunks ON audio_chunks
  USING (session_id IN (SELECT id FROM sessions WHERE doctor_id = auth.uid()));
```

### 7.3 Session Status State Machine

```
idle
  |-- [start recording] --> recording
recording
  |-- [pause]                    --> paused
  |-- [stop + all chunks OK]     --> audio_uploaded
  |-- [stop + chunk upload fail] --> audio_upload_failed (retry available)
paused
  |-- [resume]           --> recording
audio_uploaded
  |-- [ASR job starts]   --> transcribing
transcribing
  |-- [ASR success]      --> generating_note
  |-- [ASR failure]      --> transcription_failed (manual re-trigger available)
generating_note
  |-- [LLM success]      --> draft
  |-- [LLM failure]      --> note_failed (manual re-trigger available)
draft
  |-- [doctor signs off] --> final
```

---

## 8. Privacy and Compliance

### 8.3 Data Security

All data in transit is encrypted via TLS 1.2 or higher. Data at rest is encrypted using AES-256 (Supabase managed keys). Access to the database and storage bucket is restricted to service-role credentials; no public row-level access is permitted without an authenticated session.

Audio recordings are stored in a private Supabase Storage bucket. Signed URLs with a 15-minute expiry are issued to the transcription worker only; they are never exposed to the frontend after upload completes.

#### 8.3.1 ASR Vendor DPA Requirements

Sending patient audio to a third-party ASR provider constitutes sharing sensitive personal data under the Digital Personal Data Protection Act 2023 (DPDP Act). A Data Processing Agreement (DPA) or equivalent contractual instrument must be in place with any vendor before any real patient audio is transmitted.

**Hard rule: No real patient audio may be sent to any ASR provider until a signed DPA is on file and recorded in the DPA Status Tracker (Section 8.5).**

A compliant DPA must cover all of the following:

| Requirement | Detail |
|---|---|
| Purpose limitation | Vendor may process audio solely for the purpose of returning a transcript to the caller. No secondary analytics, product improvement, or any other use is permitted. |
| No model training on patient audio | Vendor must contractually prohibit use of customer audio or derived transcripts to train, fine-tune, or evaluate any ML model, unless the customer grants explicit opt-in consent per session. |
| Data residency preference | Processing and temporary storage must occur within India where the vendor supports it. Where India-region infrastructure is unavailable, the vendor must confirm the legal basis for cross-border transfer under DPDP Act Section 16 and applicable rules. |
| Breach notification SLA | Vendor must notify Gooqi Health within 72 hours of discovering a breach affecting customer data, consistent with DPDP Act obligations. |
| Sub-processor disclosure | Vendor must provide and maintain a current list of sub-processors with access to customer audio or transcripts. Material additions to the sub-processor list require advance notice of at least 14 days. |
| Audit rights | Customer (or a third-party auditor appointed by customer) must have the right to audit vendor compliance with the DPA, or to receive a current SOC 2 Type II or equivalent report in lieu of audit. |
| Deletion on termination | Vendor must delete all customer audio and derived data within 30 days of contract termination, and provide written confirmation of deletion. |

**Known DPA availability by candidate vendor:**

- **Sarvam AI** — India-headquartered; data processed within India. DPA is available and typically straightforward to execute. Preferred vendor from a DPDP compliance standpoint. Contact: enterprise sales or legal@sarvam.ai.
- **Deepgram** — US-based; offers a standard DPA and Business Associate Agreement (BAA) on request via their enterprise tier. Data residency for India is not natively available; cross-border transfer basis must be documented. Request DPA at deepgram.com/legal.
- **Google Cloud (Chirp / Speech-to-Text)** — DPA is available through the Google Cloud Data Processing Addendum, executed at the Cloud account level. India region (asia-south1) is available, satisfying residency preference. Confirm the addendum is active on the project before use.
- **Augnito** — India-based, healthcare-focused. DPA must be requested directly from their commercial team; no self-serve flow exists as of this writing. Allow additional lead time (up to 5 business days) for their legal review cycle.

#### 8.3.2 Self-Hosted ASR Fallback

If no ASR vendor DPA is signed within **14 calendar days of pilot start**, all transcription must be routed to a self-hosted fallback: `faster-whisper` running the `large-v3` model on a Railway GPU instance provisioned and controlled entirely by Gooqi Health.

The self-hosted path processes audio entirely within infrastructure owned and operated by Gooqi Health. No patient data leaves Gooqi Health's control, eliminating the third-party processor risk for the duration of the DPA gap.

**Implementation:**

The fallback is a concrete implementation of the `ASRProvider` interface (Section 6.2), named `FasterWhisperASRProvider`. It is selected at runtime via the `ASR_PROVIDER` environment variable. No code change is required to switch providers — only the env var changes.

```
ASR_PROVIDER=faster_whisper   # routes to FasterWhisperASRProvider (self-hosted Railway GPU)
ASR_PROVIDER=sarvam           # routes to SarvamASRProvider
ASR_PROVIDER=deepgram         # routes to DeepgramASRProvider
ASR_PROVIDER=google_chirp     # routes to GoogleChirpASRProvider
ASR_PROVIDER=augnito          # routes to AugnitoASRProvider
```

The `FasterWhisperASRProvider` wraps a lightweight FastAPI service deployed on Railway. The service accepts a signed Supabase Storage URL, streams the audio file, runs inference on `large-v3`, and returns a response conforming to `TranscriptResult`. Speaker diarisation in the fallback is performed by `pyannote.audio` (requires a Hugging Face token stored as a Railway secret, not in source control).

**Fallback activation and deactivation:**

| Event | Action |
|---|---|
| Pilot day 0 | `ASR_PROVIDER` is set to the primary vendor chosen from the bake-off (default: `sarvam`). |
| Day 14 — DPA not signed | `ASR_PROVIDER` is changed to `faster_whisper` in the Railway environment. Incident is logged in DPA Status Tracker. |
| DPA signed (any date) | `ASR_PROVIDER` is reverted to the target vendor. Fallback Railway GPU instance may be scaled to zero (not deleted — keep as standing fallback). |

The fallback does not impose a product code freeze. Clinicians continue using the application without interruption; only the transcription backend changes.

**Accuracy note:** `faster-whisper large-v3` performance on Hindi-English code-switched audio is acceptable for a pilot (WER ~18–22% on mixed-language clinical speech in internal benchmarks) but is expected to underperform Sarvam's Hindi-tuned models. Accuracy delta should be tracked in pilot metrics and used to prioritise DPA closure with Sarvam.

---

### 8.4 Data Retention

| Data type | Retention period | Deletion mechanism |
|---|---|---|
| Audio recordings | 30 days from session end | Automated purge job (see below) |
| Transcripts | 7 years | Manual or future automated purge after statutory period |
| Clinical notes (SOAP) | 7 years | Same as transcripts |
| Consent logs | **Indefinite — must not be deleted** | No automated deletion; records are append-only |
| DPA execution records | Lifetime of vendor relationship + 7 years | Manual, on legal team instruction only |

**Consent log retention:** The consent log table records the fact that a patient (or their representative) consented to AI-assisted transcription for each session. This record constitutes evidence of a lawful basis for processing under the DPDP Act. Rows in the `consent_log` table must never be deleted by any automated job or application code path. Deletion, if ever required (e.g., by a court order), must be performed manually by a database administrator with a written audit trail.

**Audio purge job:** The audio purge job runs on a BullMQ scheduled job (not `pg_cron`). `pg_cron` cannot issue HTTP calls to the Supabase Storage delete API; it is restricted to SQL within the database. The BullMQ job runs on the same Railway service that hosts the job queue worker. It executes on a daily schedule, queries `sessions` for rows where `session_end < NOW() - INTERVAL '30 days'` and `audio_purged_at IS NULL`, calls the Supabase Storage delete API for each matching audio object, and then stamps `audio_purged_at` on the session row. Failures are retried with exponential backoff; persistent failures alert the on-call engineer via the standard alerting channel.

---

### 8.5 DPA Status Tracker

This table is the single source of truth for ASR vendor DPA status. It must be updated before any change to `ASR_PROVIDER` in a production or pilot environment. The engineering lead and legal/compliance owner are jointly responsible for keeping it current.

| Provider | DPA Status | Data Residency | Model Training Opt-out | Notes |
|---|---|---|---|---|
| Sarvam AI | Not yet executed — outreach initiated | India (native) | Confirmed contractually available | Preferred primary vendor. Expedite DPA execution. |
| Deepgram | Not yet executed | US only (no India region) | Available via enterprise DPA | Cross-border transfer basis under DPDP Act Section 16 must be documented before use. |
| Google Cloud (Chirp) | Not yet executed — Cloud DPA addendum available self-serve | India region available (asia-south1) | Covered under Google Cloud DPA | Execute Google Cloud Data Processing Addendum at account level before routing any audio. |
| Augnito | Not yet executed — commercial outreach required | India (native) | Must be confirmed in DPA text | Allow 5+ business day lead time for Augnito legal review. |
| faster-whisper (self-hosted) | N/A — no third-party processor | Gooqi Health Railway infrastructure | N/A | Fallback only. No DPA required. Activate if primary vendor DPA not signed by pilot day 14. |

---

## 9. ASR Vendor Bake-off

### 9.1 Purpose

Select the ASR provider that delivers the lowest WER on Indian clinical speech before committing to a default. The abstraction layer (§6.2) means this decision is revisable.

### 9.2 Test Dataset

Construct a held-out test set of at minimum 100 audio clips (increased from initial 20-30 estimate) representing:
- Pure Indian-accented English (clinical vocabulary)
- Hindi-dominant with English medical terms
- Hinglish: mid-sentence code-switching
- Noisy background (clinic ambient noise, 50–65 dB)
- Two-speaker conversations (doctor + patient) requiring diarisation
- Three-speaker conversations (doctor + patient + attendant)

Clips: 2–10 minutes each. Ground-truth transcripts manually created by a bilingual annotator.

### 9.3 Evaluation Criteria

| Criterion | Weight | How Measured |
|-----------|--------|--------------|
| Word Error Rate (WER) — Hinglish | 35% | Standard WER on ground-truth; Roman script normalised |
| WER — Hindi utterances | 20% | Same, Devanagari output normalised to Roman for comparison |
| Speaker diarisation accuracy | 15% | Diarisation Error Rate (DER) on 2-speaker and 3-speaker clips |
| Medical term accuracy | 15% | Manually checked: drug names, anatomy, procedures |
| Latency (time to transcript / audio duration) | 10% | Ratio; lower is better |
| Cost per minute of audio | 5% | From vendor pricing page |

### 9.4 Candidate Providers

| Provider | Hinglish Support | Diarisation | Notes |
|----------|-----------------|-------------|-------|
| Sarvam AI | Native Indian language model; built for Hinglish | Available | India-based; data stays in India; preferred for DPDP compliance |
| Augnito | Medical-domain Indian ASR; built for clinical dictation | Limited | Medical vocabulary optimised; less general Hinglish |
| Deepgram Nova-2 | Multi-language model; some Hindi support | Yes (Nova-2) | Strong diarisation; weaker on heavy code-switching |
| Google Chirp | Multilingual universal model | Via speaker labels | Good Hindi; code-switching quality needs testing |
| faster-whisper (fallback) | Good multilingual; self-hosted | Post-processing | DPA-free fallback; lower WER on general speech but no medical fine-tuning |

### 9.5 Scoring and Decision

Run each provider's API on the full test set. Score each criterion, apply weights, produce a ranked table. The top scorer becomes the default provider. If Sarvam scores within 10% of the top scorer, prefer Sarvam for compliance reasons (data residency).

---

## 10. Success Metrics and KPIs

### 10.1 Technical Quality

| Metric | Threshold (Acceptable) | Target (Good) |
|--------|----------------------|---------------|
| WER on Hinglish test set | ≤ 30% | ≤ 20% |
| WER on Hindi-dominant clips | ≤ 35% | ≤ 25% |
| Diarisation Error Rate | ≤ 20% | ≤ 10% |
| Transcription job latency (p95) | ≤ 3 min / 10-min audio | ≤ 90 sec |
| Note generation latency (p95) | ≤ 60 sec | ≤ 30 sec |
| System uptime | ≥ 99% | ≥ 99.9% |

### 10.2 Pilot Adoption (4-week pilot, 3–5 doctors)

| Metric | Target |
|--------|--------|
| Sessions completed end-to-end (audio → final note) | ≥ 80% of started sessions |
| Doctor sign-off rate (note reaches final) | ≥ 70% of draft notes |
| Time from session stop to draft note ready | ≤ 5 min (p90) |
| Doctor edit rate (% of SOAP fields modified) | Track only (no target — baseline data) |
| Doctor satisfaction (post-pilot survey) | ≥ 3.5 / 5 on "would use daily" |
| Prescription extraction accuracy (manual spot check of 50 Rx) | ≥ 90% field-level accuracy |

### 10.3 Compliance

| Metric | Requirement |
|--------|-------------|
| Sessions with consent logged | 100% |
| Sessions where audio was processed without consent | 0 |
| Sessions where audio was sent to ASR vendor without signed DPA | 0 |

---

## 11. Out of Scope / Future Roadmap

| Item | Notes |
|------|-------|
| Real-time streaming transcription | Requires WebSocket ASR pipeline; deferred to v2 |
| Multilingual patient summary (Hindi, Tamil, Marathi) | High value; requires translation layer; v2 |
| Mobile-native app (iOS / Android) | Web app suffices for pilot; native needed for scale |
| EHR / FHIR integration | Critical for hospital buyers; out of scope for startup prototype |
| ICD-10 / SNOMED coding | Valuable for billing; complex to get right; v3 |
| Analytics and population health dashboards | Out of scope |
| Multi-clinic / enterprise admin | Single-practice first |
| Patient portal with session history access | v2 |
| WhatsApp / SMS delivery of visit summary | High India relevance; v2 |
| Training data pipeline (fine-tune on corrected notes) | Doctor edits stored but fine-tuning loop is v3 |
| Doctor amendment flow (edit finalised notes) | Needed for production; v2 |
| Doctor re-authentication via OTP/DSC for sign-off | v2 enhancement |

---

## 12. Open Questions

| # | Question | Owner | Priority | Status |
|---|----------|-------|----------|--------|
| OQ-1 | Which ASR provider wins the bake-off? | Engineering | High | Open |
| OQ-2 | Is English-only consent checkbox sufficient for DPDP? Hindi consent text added for v1 — is this sufficient? | Legal | High | Partially addressed |
| OQ-3 | Should patient records include ABHA health ID? | Product | Medium | Open |
| OQ-4 | DPA with ASR provider before sending real patient audio? | Legal | High | Addressed — DPA required; faster-whisper fallback designed |
| OQ-5 | Devanagari vs Roman transliteration to LLM? | Engineering | Medium | Resolved — Roman script via ASRProvider normalisation |
| OQ-6 | Should doctor sign-off be cryptographically signed? | Product | Low v1 | Open |
| OQ-7 | Audio retention: immediate vs 30-day? | Product / Legal | Medium | Open |
| OQ-8 | Hindi-only transcript → Hindi SOAP note acceptable? | Product | Medium | Open |
| OQ-9 | Is 60-minute session cap sufficient? | Product | Low v1 | Open |
| OQ-10 | Who owns the data — doctor, clinic, patient? | Legal | High | Open — must resolve before pilot |
