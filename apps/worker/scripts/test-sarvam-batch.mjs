// One-off manual test: exercise SarvamBatchASRProvider directly against a real
// audio file already sitting in Supabase storage, bypassing the API/BullMQ.
// Run (from apps/worker): pnpm exec tsx scripts/test-sarvam-batch.mjs <sessionId>
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const { SarvamBatchASRProvider } = await import("@gooqi/shared");

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Usage: node test-sarvam-batch.mjs <sessionId>");
  process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const audioPath = `sessions/${sessionId}/audio.webm`;
const { data: signed, error: urlErr } = await db.storage
  .from("session-audio")
  .createSignedUrl(audioPath, 900);
if (urlErr || !signed?.signedUrl) {
  console.error("Failed to sign URL:", urlErr?.message);
  process.exit(1);
}
console.log("Signed URL OK, transcribing via Sarvam-Batch…");

const provider = new SarvamBatchASRProvider();
const start = Date.now();
try {
  const result = await provider.transcribe(signed.signedUrl, {
    language: "auto",
    speakerCount: 2,
    maxSpeakers: 3,
    audioFormat: "webm",
    scriptOutput: "roman",
    noiseReduction: true,
  });
  console.log(`Done in ${Date.now() - start}ms`);
  console.log(JSON.stringify({
    providerName: result.providerName,
    languageDetected: result.languageDetected,
    overallConfidence: result.overallConfidence,
    durationMs: result.durationMs,
    turnCount: result.turns.length,
    turns: result.turns.slice(0, 5),
  }, null, 2));
} catch (err) {
  console.error(`FAILED after ${Date.now() - start}ms:`, err.name, err.message);
  process.exit(1);
}
