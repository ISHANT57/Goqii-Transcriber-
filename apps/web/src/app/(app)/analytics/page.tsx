"use client";

import { useEffect, useState } from "react";
import { BarChart3, Pill, Stethoscope } from "lucide-react";
import { useApi } from "@/lib/api";
import type { AnalyticsResponse } from "@/lib/api-types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsPage() {
  const { request } = useApi();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<AnalyticsResponse>("/api/analytics")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics."));
  }, [request]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          A quick look at your practice — visit volume, common diagnoses, and prescribed drugs.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            Visits per week
          </CardTitle>
        </CardHeader>
        <CardBody>
          {!data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <WeeklyBars series={data.visitsByWeek} />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="size-4 text-primary" />
              Top diagnoses
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <RankedBars items={data.topDiagnoses} empty="No diagnoses recorded yet." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="size-4 text-primary" />
              Top prescribed drugs
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <RankedBars items={data.topDrugs} empty="No prescriptions recorded yet." />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function WeeklyBars({ series }: { series: { week: string; count: number }[] }) {
  if (series.every((s) => s.count === 0)) {
    return <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>;
  }
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div className="flex h-32 items-end gap-2">
      {series.map((s) => (
        <div key={s.week} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium tabular-nums text-foreground/80">
            {s.count}
          </span>
          <div
            className="w-full rounded-t bg-primary/70"
            style={{ height: `${Math.max(4, (s.count / max) * 88)}px` }}
          />
          <span className="text-[10px] text-muted-foreground">
            {new Date(s.week).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function RankedBars({
  items,
  empty,
}: {
  items: { label: string; count: number }[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{item.label}</span>
            <span className="tabular-nums text-muted-foreground">{item.count}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
