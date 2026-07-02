import type { SpeakerLabel, Turn } from "../types.js";

/**
 * Shapes and helpers shared by the real-time (`sarvam.ts`) and batch
 * (`sarvamBatch.ts`) Sarvam providers — both return the same
 * `SpeechToTextResponse`-shaped JSON (confirmed against the live API for both
 * endpoints), so segment/turn mapping is identical either way.
 */

export interface SarvamSegment {
  speaker_id?: string | number;
  speaker?: string | number;
  start_time_seconds?: number;
  end_time_seconds?: number;
  start?: number;
  end?: number;
  transcript?: string;
  text?: string;
  confidence?: number;
}

export interface SarvamResponse {
  transcript?: string;
  language_code?: string;
  segments?: SarvamSegment[];
  diarized_transcript?: { entries?: SarvamSegment[] };
}

/**
 * Sarvam speaker ids may be strings ("speaker_0") or integers. First distinct
 * speaker → doctor, second → patient, third → other, else unknown.
 */
export function normaliseSpeaker(s: string | number | undefined): SpeakerLabel {
  const key = String(s ?? "").toLowerCase();
  switch (key) {
    case "0":
    case "speaker_0":
    case "spk_0":
      return "doctor";
    case "1":
    case "speaker_1":
    case "spk_1":
      return "patient";
    case "2":
    case "speaker_2":
    case "spk_2":
      return "other";
    default:
      return "unknown";
  }
}

/**
 * Map diarized segments → turns. If diarization is absent/empty, emit a
 * single "unknown" turn covering the full transcript.
 */
export function sarvamResponseToTurns(raw: SarvamResponse): Turn[] {
  const segments = raw.diarized_transcript?.entries ?? raw.segments;
  if (segments && segments.length > 0) {
    return segments.map((seg) => ({
      speaker: normaliseSpeaker(seg.speaker_id ?? seg.speaker),
      startMs: Math.round((seg.start_time_seconds ?? seg.start ?? 0) * 1000),
      endMs: Math.round((seg.end_time_seconds ?? seg.end ?? 0) * 1000),
      text: seg.transcript ?? seg.text ?? "",
      confidence: seg.confidence ?? 0.7,
    }));
  }
  return [
    {
      speaker: "unknown",
      startMs: 0,
      endMs: 0,
      text: raw.transcript ?? "",
      confidence: 0.7,
    },
  ];
}

/** Duration + duration-weighted mean confidence from a turn list. */
export function aggregateTurns(turns: Turn[]): { durationMs: number; overallConfidence: number } {
  const durationMs = turns.at(-1)?.endMs ?? 0;
  const overallConfidence = turns.length
    ? turns.reduce((a, t) => a + t.confidence * Math.max(1, t.endMs - t.startMs), 0) /
      turns.reduce((a, t) => a + Math.max(1, t.endMs - t.startMs), 0)
    : 0;
  return { durationMs, overallConfidence };
}

/** "hi-IN" for Hindi, "en-IN" for English, "unknown" for auto-detect. */
export function toSarvamLanguageCode(language: "hi" | "en-IN" | "auto"): string {
  return language === "auto" ? "unknown" : language === "hi" ? "hi-IN" : "en-IN";
}
