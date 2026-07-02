"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api";
import type {
  AcknowledgedChunksResponse,
  ChunkUploadResponse,
} from "@/lib/api-types";
import {
  clearSession,
  getChunk,
  getChunkIndices,
  markChunksUploaded,
  scanPendingSessions,
  type SessionPending,
} from "@/lib/recording/idb";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CrashRecoveryBanner() {
  const router = useRouter();
  const { request, requestMultipart } = useApi();
  const [pending, setPending] = useState<SessionPending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const scan = useCallback(async () => {
    try {
      setPending(await scanPendingSessions());
    } catch {
      /* IndexedDB unavailable — ignore */
    }
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);

  const resume = useCallback(
    async (sessionId: string) => {
      setBusy(sessionId);
      setMessage(null);
      try {
        // Ask the server which chunk indices it already has, upload the delta.
        let acknowledged: number[] = [];
        try {
          const res = await request<AcknowledgedChunksResponse>(
            `/api/sessions/${sessionId}/chunks/acknowledged`,
          );
          acknowledged = res?.acknowledgedIndices ?? [];
        } catch {
          acknowledged = [];
        }
        if (acknowledged.length > 0) {
          await markChunksUploaded(sessionId, acknowledged);
        }

        const indices = await getChunkIndices(sessionId);
        const ackSet = new Set(acknowledged);
        for (const index of indices) {
          if (ackSet.has(index)) continue;
          const chunk = await getChunk(sessionId, index);
          if (!chunk || chunk.uploaded) continue;
          const fd = new FormData();
          fd.append("chunkIndex", String(index));
          fd.append("chunk", chunk.blob, `chunk-${index}.webm`);
          const up = await requestMultipart<ChunkUploadResponse>(
            `/api/sessions/${sessionId}/chunks`,
            fd,
          );
          await markChunksUploaded(
            sessionId,
            up?.acknowledgedIndices ?? [index],
          );
        }

        // Offer to finalise the audio now that the delta is uploaded.
        await request(`/api/sessions/${sessionId}/finalise-audio`, {
          method: "POST",
          body: { total_chunks: indices.length },
        });

        await clearSession(sessionId);
        setMessage("Recording recovered and submitted for processing.");
        await scan();
        router.push(`/sessions/${sessionId}`);
      } catch (err) {
        setMessage(
          err instanceof Error
            ? `Could not resume: ${err.message}`
            : "Could not resume recording.",
        );
      } finally {
        setBusy(null);
      }
    },
    [request, requestMultipart, router, scan],
  );

  const discard = useCallback(
    async (sessionId: string) => {
      setBusy(sessionId);
      setMessage(null);
      try {
        await request(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          body: { status: "abandoned" },
        }).catch(() => {});
        await clearSession(sessionId);
        await scan();
      } finally {
        setBusy(null);
      }
    },
    [request, scan],
  );

  if (pending.length === 0 && !message) return null;

  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-3">
        {message && (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {message}
          </p>
        )}
        {pending.map((p) => (
          <div
            key={p.sessionId}
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                Unsent recording found for session{" "}
                <span className="font-mono">{p.sessionId.slice(0, 8)}</span> —{" "}
                {p.pendingCount} of {p.totalCount} chunk
                {p.totalCount > 1 ? "s" : ""} pending upload.
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => resume(p.sessionId)}
                loading={busy === p.sessionId}
              >
                {busy === p.sessionId ? "Resuming…" : "Resume"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => discard(p.sessionId)}
                disabled={busy === p.sessionId}
              >
                Discard
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
