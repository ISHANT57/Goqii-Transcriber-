"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useApi } from "@/lib/api";
import type { ReminderItem } from "@/lib/api-types";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/** Follow-ups due soon or overdue, from GET /api/reminders. Renders nothing if empty. */
export function RemindersPanel() {
  const { request } = useApi();
  const [reminders, setReminders] = useState<ReminderItem[] | null>(null);

  useEffect(() => {
    request<{ reminders: ReminderItem[] }>("/api/reminders")
      .then((res) => setReminders(res.reminders ?? []))
      .catch(() => setReminders([]));
  }, [request]);

  if (!reminders || reminders.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="size-4 text-primary" />
        Follow-ups due
        <span className="text-xs font-normal text-muted-foreground">
          ({reminders.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {reminders.map((r) => (
          <Link
            key={r.session_id}
            href={`/sessions/${r.session_id}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted",
              r.overdue
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted/40",
            )}
          >
            <span className="font-medium">{r.patient_name || "Unknown patient"}</span>
            <span className="ml-1.5 text-xs opacity-80">
              {r.overdue ? "overdue" : "due"} {r.follow_up_date}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
