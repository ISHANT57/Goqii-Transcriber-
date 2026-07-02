"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/api";
import type { SessionDetail } from "@/lib/api-types";
import type { SessionStatus } from "@gooqi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import { ReviewEditor } from "@/components/review/ReviewEditor";
import { ReadOnlyView } from "@/components/review/ReadOnlyView";

const PROCESSING: SessionStatus[] = [
  "audio_uploaded",
  "transcribing",
  "generating_note",
];
const FAILED: SessionStatus[] = ["transcription_failed", "note_failed"];
// Statuses that can still change without user action on this page — includes
// "recording" (e.g. a second tab, or navigating back from history mid-visit)
// in addition to PROCESSING, matching sessions/page.tsx's own polling set.
// Without "recording" here, opening this page during an in-progress
// recording froze on the static "still recording" card forever, even after
// the recording finished elsewhere.
const POLLING_STATUSES: SessionStatus[] = ["recording", ...PROCESSING];

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { request } = useApi();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await request<SessionDetail | { session: SessionDetail }>(
        `/api/sessions/${id}`,
      );
      const s = "session" in data ? data.session : data;
      setSession(s);
      setError(null);
      return s;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
      return null;
    }
  }, [id, request]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 4s while processing.
  useEffect(() => {
    if (!session) return;
    const isProcessing = POLLING_STATUSES.includes(session.status);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (isProcessing) {
      pollRef.current = setInterval(() => void load(), 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session, load]);

  async function retry() {
    if (!session) return;
    setRetrying(true);
    try {
      // Re-trigger the failed stage. A rejection here (e.g. 409 "not in a
      // retryable state") must reach the user — silently swallowing it left
      // a stuck failed session with the button just stopping its spinner and
      // no explanation of what happened.
      await request(`/api/sessions/${id}/retry`, { method: "POST" });
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry.");
    } finally {
      setRetrying(false);
    }
  }

  if (error && !session) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </p>
          <Button variant="secondary" onClick={() => load()}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { status } = session;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">
          {session.patient_name || "Session"}
        </h1>
        <StatusBadge status={status} />
      </div>

      {status === "recording" && (
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">
              This session is still recording. Return to the recording tab to
              finish it.
            </p>
          </CardBody>
        </Card>
      )}

      {PROCESSING.includes(status) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              Processing…
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProcessingSteps status={status} />
            <p className="text-xs text-muted-foreground">
              This page refreshes automatically.
            </p>
          </CardBody>
        </Card>
      )}

      {FAILED.includes(status) && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" />
              {status === "transcription_failed"
                ? "Transcription failed"
                : "Note generation failed"}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {session.failure_reason && (
              <p className="text-sm text-muted-foreground">
                {session.failure_reason}
              </p>
            )}
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={retry} loading={retrying}>
              <RefreshCw className="size-4" />
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </CardBody>
        </Card>
      )}

      {status === "draft" && <ReviewEditor sessionId={id} onFinalised={load} />}

      {status === "final" && (
        <ReadOnlyView
          sessionId={id}
          patientName={session.patient_name ?? null}
          visitDate={session.started_at ?? session.created_at ?? null}
        />
      )}

      {status === "abandoned" && (
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">
              This session was abandoned.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ProcessingSteps({ status }: { status: SessionStatus }) {
  const steps: { key: SessionStatus; label: string }[] = [
    { key: "audio_uploaded", label: "Preparing audio" },
    { key: "transcribing", label: "Transcribing the consultation" },
    { key: "generating_note", label: "Generating the clinical note" },
  ];
  const order: SessionStatus[] = [
    "audio_uploaded",
    "transcribing",
    "generating_note",
  ];
  const current = order.indexOf(status);

  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            {done ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-success text-success-foreground">
                ✓
              </span>
            ) : active ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <span className="size-5 rounded-full border border-border" />
            )}
            <span
              className={
                active
                  ? "font-medium"
                  : done
                    ? "text-muted-foreground line-through"
                    : "text-muted-foreground"
              }
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
