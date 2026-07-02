import * as React from "react";
import { cn } from "@/lib/cn";
import type { SessionStatus } from "@gooqi/shared";

type Tone = "amber" | "green" | "red" | "blue" | "slate" | "teal";

const tones: Record<Tone, string> = {
  amber:
    "bg-warning/15 text-warning-foreground/90 dark:text-warning [&]:text-amber-700 dark:[&]:text-amber-400",
  green: "bg-success/15 text-success dark:text-success",
  red: "bg-destructive/15 text-destructive dark:text-destructive",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  slate: "bg-muted text-muted-foreground",
  teal: "bg-primary/15 text-primary",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<SessionStatus, Tone> = {
  recording: "blue",
  audio_uploaded: "blue",
  transcribing: "blue",
  generating_note: "blue",
  transcription_failed: "red",
  note_failed: "red",
  draft: "amber",
  final: "green",
  abandoned: "slate",
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  recording: "Recording",
  audio_uploaded: "Uploaded",
  transcribing: "Transcribing",
  generating_note: "Generating note",
  transcription_failed: "Transcription failed",
  note_failed: "Note failed",
  draft: "Draft",
  final: "Final",
  abandoned: "Abandoned",
};

const ACTIVE: SessionStatus[] = [
  "recording",
  "audio_uploaded",
  "transcribing",
  "generating_note",
];

export function StatusBadge({ status }: { status: SessionStatus }) {
  const pulsing = ACTIVE.includes(status);
  return (
    <Badge tone={STATUS_TONE[status]}>
      {pulsing && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
