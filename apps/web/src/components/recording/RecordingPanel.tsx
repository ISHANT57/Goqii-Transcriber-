"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Mic, Pause, Play, Square, WifiOff } from "lucide-react";
import {
  CHUNK_TIMESLICE_MS,
  MAX_RECORDING_MS,
  RECORDING_WARNING_MS,
} from "@gooqi/shared/db";
import { useApi } from "@/lib/api";
import type { ChunkUploadResponse } from "@/lib/api-types";
import {
  clearSession,
  getPendingChunks,
  markChunksUploaded,
  saveChunk,
  type StoredChunk,
} from "@/lib/recording/idb";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

type RecState = "idle" | "recording" | "paused" | "stopping" | "stopped";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const preferred = "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported(preferred)) return preferred;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
}

export function RecordingPanel({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { request, requestMultipart } = useApi();

  const [state, setState] = useState<RecState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadPaused, setUploadPaused] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [inflight, setInflight] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const chunkIndexRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const uploadsRef = useRef<Set<Promise<unknown>>>(new Set());
  const startTimeRef = useRef(0);
  const accumulatedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);

  // --- Live audio visualizer (non-essential; reads the same stream) -------
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    const canvas = canvasRef.current;
    const c = canvas?.getContext("2d");
    if (canvas && c) c.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startVisualizer = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const render = () => {
        rafRef.current = requestAnimationFrame(render);
        const canvas = canvasRef.current;
        const a = analyserRef.current;
        if (!canvas || !a) return;
        const c = canvas.getContext("2d");
        if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);

        const bins = a.frequencyBinCount;
        const data = new Uint8Array(bins);
        a.getByteFrequencyData(data);

        const color = getComputedStyle(canvas).color || "#0f766e";
        c.fillStyle = color;

        const bars = 40;
        const step = Math.floor(bins / bars);
        const gap = 3;
        const barW = (w - gap * (bars - 1)) / bars;
        for (let i = 0; i < bars; i++) {
          const v = data[i * step] / 255;
          const barH = Math.max(2, v * h);
          const x = i * (barW + gap);
          const y = (h - barH) / 2;
          c.globalAlpha = 0.4 + v * 0.6;
          c.beginPath();
          c.roundRect(x, y, barW, barH, barW / 2);
          c.fill();
        }
        c.globalAlpha = 1;
      };
      render();
    } catch {
      /* visualizer is non-essential */
    }
  }, []);

  // --- Upload with retry/backoff -----------------------------------------
  const uploadChunk = useCallback(
    async (chunk: StoredChunk): Promise<void> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const fd = new FormData();
          fd.append("chunkIndex", String(chunk.chunkIndex));
          fd.append(
            "chunk",
            chunk.blob,
            `chunk-${chunk.chunkIndex}.webm`,
          );
          const res = await requestMultipart<ChunkUploadResponse>(
            `/api/sessions/${sessionId}/chunks`,
            fd,
          );
          const ack = res?.acknowledgedIndices ?? [chunk.chunkIndex];
          await markChunksUploaded(sessionId, ack);
          consecutiveFailuresRef.current = 0;
          setUploadPaused(false);
          return;
        } catch {
          if (attempt < 2) await sleep(1000 * 2 ** attempt); // 1s, 2s, (4s)
        }
      }
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current > 3) setUploadPaused(true);
      throw new Error(`chunk ${chunk.chunkIndex} upload failed`);
    },
    [requestMultipart, sessionId],
  );

  const trackUpload = useCallback((p: Promise<unknown>) => {
    uploadsRef.current.add(p);
    setInflight(uploadsRef.current.size);
    p.finally(() => {
      uploadsRef.current.delete(p);
      setInflight(uploadsRef.current.size);
    });
  }, []);

  // --- ondataavailable: persist FIRST, then upload -----------------------
  const handleData = useCallback(
    (e: BlobEvent) => {
      if (!e.data || e.data.size === 0) return;
      const index = chunkIndexRef.current++;
      const chunk: StoredChunk = {
        sessionId,
        chunkIndex: index,
        blob: e.data,
        uploaded: false,
      };
      const p = (async () => {
        await saveChunk(chunk); // IndexedDB before network
        try {
          await uploadChunk(chunk);
        } catch {
          /* left pending in IDB; retried on 'online' / finalise */
        }
      })();
      trackUpload(p);
    },
    [sessionId, uploadChunk, trackUpload],
  );

  // --- Wake lock ----------------------------------------------------------
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      /* unsupported or denied — non-fatal */
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      /* ignore */
    }
    wakeLockRef.current = null;
  }, []);

  // --- Timer --------------------------------------------------------------
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // finalise is defined before stop because stop calls it on the no-recorder path
  const finalise = useCallback(async () => {
    // Wait for all in-flight uploads, then retry any still-pending chunks.
    await Promise.allSettled(Array.from(uploadsRef.current));
    const pending = await getPendingChunks(sessionId);
    for (const c of pending) {
      await uploadChunk(c).catch(() => {});
    }
    try {
      await request(`/api/sessions/${sessionId}/finalise-audio`, {
        method: "POST",
        body: {
          audio_duration_ms: Math.round(elapsedMs),
          total_chunks: chunkIndexRef.current,
        },
      });
      // The server has the full assembled audio now — the local copy is no
      // longer needed. Without this, every completed recording's raw audio
      // Blobs stay in IndexedDB forever (clearSession is otherwise only
      // called from the crash-recovery path), so browser storage grows
      // unbounded over routine use until it hits a quota error.
      await clearSession(sessionId).catch(() => {});
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to finalise: ${err.message}`
          : "Failed to finalise recording.",
      );
    }
    stopVisualizer();
    setState("stopped");
    router.push(`/sessions/${sessionId}`);
  }, [elapsedMs, request, router, sessionId, uploadChunk, stopVisualizer]);

  const stop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setState("stopping");
    stopTimer();
    await releaseWakeLock();
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") {
      // onstop (set in start) runs finalise after the final dataavailable.
      mr.stop();
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      await finalise();
    }
  }, [finalise, releaseWakeLock, stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      const e = accumulatedRef.current + (Date.now() - startTimeRef.current);
      setElapsedMs(e);
      if (e >= RECORDING_WARNING_MS) setShowWarning(true);
      if (e >= MAX_RECORDING_MS) void stop();
    }, 500);
  }, [stop, stopTimer]);

  // --- Controls -----------------------------------------------------------
  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      // Without an explicit bitrate, some browsers default audio/webm to
      // ~128kbps, which puts a full MAX_RECORDING_MS (60min) session close to
      // or over common storage object-size limits (~50MB). 32kbps mono is
      // ample for speech ASR and caps a 60min recording at ~14.4MB.
      const mr = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32_000,
      });
      mr.ondataavailable = handleData;
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        void finalise();
      };
      recorderRef.current = mr;
      chunkIndexRef.current = 0;
      accumulatedRef.current = 0;
      startTimeRef.current = Date.now();
      consecutiveFailuresRef.current = 0;
      mr.start(CHUNK_TIMESLICE_MS);
      setState("recording");
      startTimer();
      void requestWakeLock();
      startVisualizer(stream);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone unavailable: ${err.message}`
          : "Could not access microphone.",
      );
    }
  }, [finalise, handleData, requestWakeLock, startTimer, startVisualizer]);

  const pause = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state === "recording") {
      mr.pause();
      accumulatedRef.current += Date.now() - startTimeRef.current;
      stopTimer();
      void releaseWakeLock();
      setState("paused");
    }
  }, [releaseWakeLock, stopTimer]);

  const resume = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state === "paused") {
      mr.resume();
      startTimeRef.current = Date.now();
      startTimer();
      void requestWakeLock();
      setState("recording");
    }
  }, [requestWakeLock, startTimer]);

  // --- Re-queue pending chunks when connectivity returns ------------------
  useEffect(() => {
    const onOnline = () => {
      void (async () => {
        const pending = await getPendingChunks(sessionId);
        for (const c of pending) {
          trackUpload(uploadChunk(c).catch(() => {}));
        }
      })();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sessionId, trackUpload, uploadChunk]);

  // --- Flush partial chunk when tab is hidden -----------------------------
  useEffect(() => {
    const onVisibility = () => {
      const mr = recorderRef.current;
      if (document.hidden && mr && mr.state === "recording") {
        try {
          mr.requestData();
        } catch {
          /* ignore */
        }
      } else if (!document.hidden && mr && mr.state === "recording") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [requestWakeLock]);

  // --- Warn before unloading while actively recording ---------------------
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state === "recording" || state === "paused") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  // --- Cleanup on unmount -------------------------------------------------
  useEffect(() => {
    return () => {
      stopTimer();
      void releaseWakeLock();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopVisualizer();
    };
  }, [releaseWakeLock, stopTimer, stopVisualizer]);

  // -----------------------------------------------------------------------
  const progress = Math.min(100, (elapsedMs / MAX_RECORDING_MS) * 100);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mic className="size-4 text-primary" />
            Recording
          </CardTitle>
          <span className="inline-flex items-center gap-2 font-mono text-lg tabular-nums">
            <Clock className="size-4 text-muted-foreground" />
            {formatElapsed(elapsedMs)}
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Waveform visualizer */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
          <canvas
            ref={canvasRef}
            className="block h-24 w-full text-primary"
          />
          {state !== "recording" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              {state === "idle" && "Waveform will appear while recording"}
              {state === "paused" && "Paused"}
              {(state === "stopping" || state === "stopped") &&
                "Finishing up…"}
            </div>
          )}
        </div>

        {/* Progress toward 60-min cap */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={
              state === "recording"
                ? "inline-block size-3 animate-pulse rounded-full bg-destructive"
                : state === "paused"
                  ? "inline-block size-3 rounded-full bg-warning"
                  : "inline-block size-3 rounded-full bg-muted-foreground/40"
            }
          />
          <span className="text-muted-foreground">
            {state === "idle" && "Ready to record"}
            {state === "recording" && "Recording…"}
            {state === "paused" && "Paused"}
            {state === "stopping" && "Finishing upload…"}
            {state === "stopped" && "Stopped"}
          </span>
          {inflight > 0 && (
            <span className="text-xs text-muted-foreground">
              ({inflight} chunk{inflight > 1 ? "s" : ""} uploading)
            </span>
          )}
        </div>

        {showWarning && state !== "stopped" && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Approaching the 60-minute limit. Recording will stop automatically
            at 60 minutes.
          </div>
        )}

        {uploadPaused && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <WifiOff className="mt-0.5 size-4 shrink-0" />
            Upload paused — check your connection. Recording continues locally.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          {state === "idle" && (
            <Button size="lg" onClick={start}>
              <Mic className="size-4" />
              Start Recording
            </Button>
          )}
          {state === "recording" && (
            <>
              <Button variant="secondary" size="lg" onClick={pause}>
                <Pause className="size-4" />
                Pause
              </Button>
              <Button variant="danger" size="lg" onClick={stop}>
                <Square className="size-4" />
                Stop
              </Button>
            </>
          )}
          {state === "paused" && (
            <>
              <Button size="lg" onClick={resume}>
                <Play className="size-4" />
                Resume
              </Button>
              <Button variant="danger" size="lg" onClick={stop}>
                <Square className="size-4" />
                Stop
              </Button>
            </>
          )}
          {state === "stopping" && (
            <Button size="lg" loading disabled>
              Finishing…
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Audio is saved on this device as it records, so a refresh or lost
          connection will not lose the consultation.
        </p>
      </CardBody>
    </Card>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
