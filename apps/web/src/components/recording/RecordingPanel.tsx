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

  // Audio input device selection (e.g. a specific mic, or "Stereo Mix" to
  // capture system audio). Empty deviceId = the browser default input.
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

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
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => { });
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

  // --- Enumerate audio input devices --------------------------------------
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((d) => d.kind === "audioinput");
      setDevices(inputs);
      // If the currently-selected device vanished (unplugged), fall back to default.
      setDeviceId((cur) =>
        cur && !inputs.some((d) => d.deviceId === cur) ? "" : cur,
      );
    } catch {
      /* enumeration unsupported — the default device still works */
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
      await uploadChunk(c).catch(() => { });
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
      await clearSession(sessionId).catch(() => { });
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
      // Disable the browser's voice-call DSP. echoCancellation / noiseSuppression
      // / autoGainControl are tuned for a single person speaking into a mic; when
      // the source is system audio (a video routed via Stereo Mix / a virtual
      // cable) they treat the playback as "noise"/"echo" and destroy the signal —
      // producing faint or empty recordings of otherwise-clear audio. Off is also
      // better for ASR generally (raw audio, no over-processing).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      streamRef.current = stream;
      // Labels are guaranteed populated now that permission is granted.
      void refreshDevices();
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
  }, [
    deviceId,
    refreshDevices,
    finalise,
    handleData,
    requestWakeLock,
    startTimer,
    startVisualizer,
  ]);

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

  useEffect(() => {
    // Device labels are only exposed after mic permission is granted. Prime a
    // one-time permission so the dropdown shows real names ("Stereo Mix",
    // "Headset Mic", …) before the first recording; then release the stream.
    let cancelled = false;
    void (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        /* denied/unavailable — enumerate anyway (labels may be blank) */
      }
      if (!cancelled) await refreshDevices();
    })();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshDevices,
      );
    };
  }, [refreshDevices]);

  // --- Re-queue pending chunks when connectivity returns ------------------
  useEffect(() => {
    const onOnline = () => {
      void (async () => {
        const pending = await getPendingChunks(sessionId);
        for (const c of pending) {
          trackUpload(uploadChunk(c).catch(() => { }));
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

        {/* Input device selector (idle only — can't switch mid-recording) */}
        {state === "idle" && (
          <div className="space-y-1.5">
            <label
              htmlFor="audio-input"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <Mic className="size-3.5" />
              Audio input
            </label>
            <select
              id="audio-input"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Default microphone</option>
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Input ${i + 1}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              To transcribe audio playing on this computer (e.g. a video call),
              pick “Stereo Mix” or a virtual audio cable.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Audio is saved on this device as it records, so a refresh or lost
          connection will not lose the consultation.
        </p>

        {/* Controls — sticky to the bottom edge on phones so Start/Pause/Stop
            stay in one-thumb reach regardless of scroll position (this card
            can get tall with the device selector + warnings visible); desktop
            keeps the original inline layout. */}
        <div className="sticky bottom-0 -mx-5 -mb-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="flex gap-3">
            {state === "idle" && (
              <Button size="lg" className="h-14 flex-1 text-base sm:h-12 sm:flex-none" onClick={start}>
                <Mic className="size-5" />
                Start Recording
              </Button>
            )}
            {state === "recording" && (
              <>
                <Button variant="secondary" size="lg" className="h-14 flex-1 text-base sm:h-12 sm:flex-none" onClick={pause}>
                  <Pause className="size-5" />
                  Pause
                </Button>
                <Button variant="danger" size="lg" className="h-14 flex-1 text-base sm:h-12 sm:flex-none" onClick={stop}>
                  <Square className="size-5" />
                  Stop
                </Button>
              </>
            )}
            {state === "paused" && (
              <>
                <Button size="lg" className="h-14 flex-1 text-base sm:h-12 sm:flex-none" onClick={resume}>
                  <Play className="size-5" />
                  Resume
                </Button>
                <Button variant="danger" size="lg" className="h-14 flex-1 text-base sm:h-12 sm:flex-none" onClick={stop}>
                  <Square className="size-5" />
                  Stop
                </Button>
              </>
            )}
            {state === "stopping" && (
              <Button size="lg" className="h-14 flex-1 text-base sm:h-12 sm:flex-none" loading disabled>
                Finishing…
              </Button>
            )}
          </div>
        </div>
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
