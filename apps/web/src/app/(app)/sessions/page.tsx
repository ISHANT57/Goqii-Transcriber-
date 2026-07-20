"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Eraser,
  ExternalLink,
  FileCheck2,
  Filter,
  Mic,
  MoreVertical,
  Phone,
  Search,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { SessionStatus } from "@gooqi/shared";
import { useApi } from "@/lib/api";
import type { SessionListItem } from "@/lib/api-types";
import { RemindersPanel } from "@/components/RemindersPanel";
import { useConfirm } from "@/components/ui/confirm";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const POLL_SET = new Set<SessionStatus>([
  "recording",
  "audio_uploaded",
  "transcribing",
  "generating_note",
]);
const PROCESSING_SET = new Set<SessionStatus>([
  "recording",
  "transcribing",
  "generating_note",
]);

type StatusFilter =
  | "all"
  | "draft"
  | "final"
  | "audio_uploaded"
  | "processing"
  | "failed"
  | "abandoned";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Draft" },
  { value: "final", label: "Final" },
  { value: "audio_uploaded", label: "Uploaded" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "abandoned", label: "Abandoned" },
];

const PAGE_SIZES = [10, 25, 50];

/** Coerce API values that may be null, empty, or the literal string "null". */
function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined")
    return null;
  return t;
}

function matchesStatus(status: SessionStatus, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "processing") return PROCESSING_SET.has(status);
  if (f === "failed") return status.endsWith("_failed");
  return status === f;
}

export default function SessionsPage() {
  const { request } = useApi();
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    try {
      const data = await request<
        SessionListItem[] | { sessions: SessionListItem[] }
      >("/api/sessions");
      const list = Array.isArray(data) ? data : data.sessions;
      setSessions(list ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const hasProcessing = useMemo(
    () => (sessions ?? []).some((s) => POLL_SET.has(s.status)),
    [sessions],
  );
  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [hasProcessing, load]);

  const stats = useMemo(() => {
    const list = sessions ?? [];
    return {
      total: list.length,
      drafts: list.filter((s) => s.status === "draft").length,
      final: list.filter((s) => s.status === "final").length,
      totalSeries: buildSeries(list, () => true),
      draftSeries: buildSeries(list, (s) => s.status === "draft"),
      finalSeries: buildSeries(list, (s) => s.status === "final"),
    };
  }, [sessions]);

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const q = filter.trim().toLowerCase();
    return sessions.filter((s) => {
      if (!matchesStatus(s.status, status)) return false;
      if (!q) return true;
      return (
        (s.patient_name ?? "").toLowerCase().includes(q) ||
        (s.patient_phone ?? "").toLowerCase().includes(q) ||
        (clean(s.chief_complaint) ?? "").toLowerCase().includes(q)
      );
    });
  }, [sessions, filter, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);
  useEffect(() => {
    setPage(1);
  }, [filter, status, pageSize]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Your recorded consultations and generated notes.
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/sessions/new">
            <Mic className="size-4" />
            New Session
          </Link>
        </Button>
      </div>

      <RemindersPanel />

      <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total sessions"
          caption="All-time consultations"
          value={stats.total}
          icon={ClipboardList}
          data={stats.totalSeries}
          loading={sessions === null}
        />
        <StatCard
          label="Drafts to review"
          caption="Pending review"
          value={stats.drafts}
          icon={Stethoscope}
          tone="warning"
          data={stats.draftSeries}
          loading={sessions === null}
        />
        <StatCard
          label="Finalised"
          caption="Completed sessions"
          value={stats.final}
          icon={FileCheck2}
          tone="success"
          data={stats.finalSeries}
          loading={sessions === null}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, phone, or complaint…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <StatusMenu value={status} onChange={setStatus} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {sessions === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasSessions={sessions.length > 0}
          filtering={sessions.length > 0}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Chief complaint</th>
                <th className="px-5 py-3">Diagnosis</th>
                <th className="px-5 py-3">Date &amp; time</th>
                <th className="px-5 py-3">Status</th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((s) => (
                <tr
                  key={s.id}
                  className="group transition-colors hover:bg-muted/40"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={s.patient_name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground group-hover:text-primary">
                          {s.patient_name || "Unknown patient"}
                        </span>
                        {s.patient_phone && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.patient_phone}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[15rem] px-5 py-3.5 align-middle">
                    <Cell value={clean(s.chief_complaint)} />
                  </td>
                  <td className="max-w-[15rem] px-5 py-3.5 align-middle">
                    <Cell value={clean(s.primary_diagnosis)} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 align-middle text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {formatDate(s.started_at ?? s.created_at)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 align-middle">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-5 py-3.5 align-middle">
                    <RowMenu
                      id={s.id}
                      patientName={s.patient_name}
                      phone={s.patient_phone}
                      onChanged={load}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="divide-y divide-border md:hidden">
            {pageRows.map((s) => (
              <div key={s.id} className="relative">
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex items-start gap-3 p-4 pr-12 transition-colors hover:bg-muted/40"
                >
                  <Avatar name={s.patient_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium">
                        {s.patient_name || "Unknown patient"}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatDate(s.started_at ?? s.created_at)}
                      </span>
                      {s.patient_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" />
                          {s.patient_phone}
                        </span>
                      )}
                    </div>
                    {clean(s.chief_complaint) && (
                      <p className="mt-2 line-clamp-2 text-sm">
                        {clean(s.chief_complaint)}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="absolute right-2 top-3">
                  <RowMenu
                    id={s.id}
                    patientName={s.patient_name}
                    phone={s.patient_phone}
                    onChanged={load}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer / pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {pageRows.length} of {filtered.length} session
              {filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-8 text-center tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <PageSizeMenu value={pageSize} onChange={setPageSize} />
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function StatusMenu({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const current = STATUS_FILTERS.find((f) => f.value === value)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="min-w-40 justify-between">
          <span className="inline-flex items-center gap-2">
            <Filter className="size-4" />
            {current.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {STATUS_FILTERS.map((f) => (
          <DropdownMenuItem key={f.value} onClick={() => onChange(f.value)}>
            <Check
              className={cn(
                "size-4",
                f.value === value ? "opacity-100 text-primary" : "opacity-0",
              )}
            />
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PageSizeMenu({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="justify-between gap-2">
          {value} per page
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PAGE_SIZES.map((n) => (
          <DropdownMenuItem key={n} onClick={() => onChange(n)}>
            <Check
              className={cn(
                "size-4",
                n === value ? "opacity-100 text-primary" : "opacity-0",
              )}
            />
            {n} per page
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({
  id,
  patientName,
  phone,
  onChanged,
}: {
  id: string;
  patientName: string | null;
  phone: string | null;
  onChanged: () => void;
}) {
  const { request } = useApi();
  const confirm = useConfirm();

  async function eraseAudio() {
    const ok = await confirm({
      title: "Erase recording?",
      description:
        "Permanently deletes the stored audio for this session. The transcript and clinical note are kept. This cannot be undone.",
      confirmText: "Erase audio",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await request(`/api/sessions/${id}/erase-audio`, { method: "POST" });
      toast.success("Audio erased");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to erase audio.");
    }
  }

  async function deleteSession() {
    const ok = await confirm({
      title: "Delete session?",
      description: `Permanently deletes this session${patientName ? ` for ${patientName}` : ""
        } — its audio, transcript, note and prescriptions. The consent record is retained for audit. This cannot be undone.`,
      confirmText: "Delete session",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await request(`/api/sessions/${id}`, { method: "DELETE" });
      toast.success("Session deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete session.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-60 group-hover:opacity-100"
          aria-label="Row actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/sessions/${id}`}>
            <ExternalLink className="size-4" />
            Open session
          </Link>
        </DropdownMenuItem>
        {phone && (
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard?.writeText(phone);
              toast.success("Phone number copied");
            }}
          >
            <Copy className="size-4" />
            Copy phone
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-amber-600 focus:text-amber-600 dark:text-amber-400"
          onClick={eraseAudio}
        >
          <Eraser className="size-4" />
          Erase audio
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={deleteSession}
        >
          <Trash2 className="size-4" />
          Delete session
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Cell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>;
  return <span className="line-clamp-2 text-foreground/90">{value}</span>;
}

function Avatar({ name }: { name: string | null }) {
  const inits = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {inits || "?"}
    </span>
  );
}

function Sparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  const w = 96;
  const h = 32;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = h - 3 - (v / max) * (h - 6);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-24", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label,
  caption,
  value,
  icon: Icon,
  tone = "primary",
  data,
  loading,
}: {
  label: string;
  caption: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning";
  data: number[];
  loading?: boolean;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-amber-600 dark:text-amber-400",
  }[tone];
  const sparkClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-amber-500",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex size-11 items-center justify-center rounded-lg ${toneClass}`}
          >
            <Icon className="size-5" />
          </span>
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-10" />
            ) : (
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
            )}
            <div className="mt-0.5 text-xs text-muted-foreground/70">
              {caption}
            </div>
          </div>
        </div>
        {!loading && <Sparkline data={data} className={sparkClass} />}
      </div>
    </Card>
  );
}

function EmptyState({
  hasSessions,
  filtering,
}: {
  hasSessions: boolean;
  filtering: boolean;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Mic className="size-6" />
      </span>
      <div>
        <p className="font-medium">
          {filtering ? "No sessions match your filters" : "No sessions yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {filtering
            ? "Try a different search or status filter."
            : "Start a new session to record your first consultation."}
        </p>
      </div>
      {!hasSessions && (
        <Button asChild>
          <Link href="/sessions/new">
            <Mic className="size-4" />
            New Session
          </Link>
        </Button>
      )}
    </Card>
  );
}

/** Count sessions per day over the last 7 calendar days (oldest → newest). */
function buildSeries(
  list: SessionListItem[],
  pred: (s: SessionListItem) => boolean,
): number[] {
  const days = 7;
  const buckets = new Array(days).fill(0);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dayMs = 86_400_000;
  for (const s of list) {
    if (!pred(s)) continue;
    const iso = s.started_at ?? s.created_at;
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    const diffDays = Math.floor((startOfToday - t) / dayMs);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();

  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
