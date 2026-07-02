"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Pill, Printer, MessagesSquare } from "lucide-react";
import type { Turn } from "@gooqi/shared";
import { useApi } from "@/lib/api";
import type {
  NoteFields,
  NoteResponse,
  PrescriptionDraft,
  TranscriptResponse,
} from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReadOnlyView({
  sessionId,
  patientName,
  visitDate,
}: {
  sessionId: string;
  patientName?: string | null;
  visitDate?: string | null;
}) {
  const { request } = useApi();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [note, setNote] = useState<Partial<NoteFields> | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNote = useCallback(async () => {
    const n = await request<NoteResponse>(`/api/sessions/${sessionId}/note`);
    setNote(n?.note ?? null);
    setPrescriptions(n?.prescriptions ?? []);
    setSummary(n?.summary ?? null);
    return n?.summary ?? null;
  }, [request, sessionId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [tx] = await Promise.all([
          request<TranscriptResponse>(
            `/api/sessions/${sessionId}/transcript`,
          ),
          loadNote(),
        ]);
        if (active) setTurns(tx?.turns ?? []);
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [request, sessionId, loadNote]);

  // Poll for the visit summary until it appears.
  useEffect(() => {
    if (summary) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      void loadNote();
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [summary, loadNote]);

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (error)
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-end no-print">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print summary
        </Button>
      </div>

      {/* PRINT AREA: patient visit summary (A5) */}
      <Card data-print-area>
        {/* Document header — only shown when printing */}
        <div className="hidden px-5 pt-5 print:block">
          <div className="text-lg font-semibold">
            {patientName || "Patient visit summary"}
          </div>
          {visitDate && (
            <div className="text-xs">Visit date: {formatVisitDate(visitDate)}</div>
          )}
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Visit Summary
          </CardTitle>
        </CardHeader>
        <CardBody>
          {summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              The patient visit summary is still being generated…
            </p>
          )}
        </CardBody>
      </Card>

      {/* Clinical note (not printed) */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Clinical Note
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <ReadField label="Chief complaint" value={note?.chief_complaint} />
          <ReadField label="Subjective" value={note?.subjective} />
          <ReadField label="Objective" value={note?.objective} />
          <ReadField label="Assessment" value={note?.assessment} />
          <ReadField label="Plan" value={note?.plan} />
          <ReadField
            label="Primary diagnosis"
            value={note?.primary_diagnosis}
          />
          {note?.differentials && note.differentials.length > 0 && (
            <ReadField
              label="Differentials"
              value={note.differentials.join(", ")}
            />
          )}
          <ReadField label="Follow-up" value={note?.follow_up} />
        </CardBody>
      </Card>

      {/* Prescriptions (not printed) */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="size-4 text-primary" />
            Prescriptions
          </CardTitle>
        </CardHeader>
        <CardBody>
          {note?.no_medication ? (
            <p className="text-sm text-muted-foreground">
              No medication prescribed.
            </p>
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Drug</th>
                    <th className="py-1 pr-3">Dose</th>
                    <th className="py-1 pr-3">Frequency</th>
                    <th className="py-1 pr-3">Duration</th>
                    <th className="py-1 pr-3">Route</th>
                    <th className="py-1">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {prescriptions.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3 font-medium">{r.drug_name}</td>
                      <td className="py-1.5 pr-3">{r.dose || "—"}</td>
                      <td className="py-1.5 pr-3">{r.frequency || "—"}</td>
                      <td className="py-1.5 pr-3">{r.duration || "—"}</td>
                      <td className="py-1.5 pr-3">{r.route || "—"}</td>
                      <td className="py-1.5">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Transcript (not printed) */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-primary" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {turns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript.</p>
          ) : (
            turns.map((t, i) => (
              <p key={i} className="text-sm">
                <span className="font-medium capitalize text-primary">
                  {t.speaker}:
                </span>{" "}
                <span>{t.text}</span>
              </p>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReadField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
