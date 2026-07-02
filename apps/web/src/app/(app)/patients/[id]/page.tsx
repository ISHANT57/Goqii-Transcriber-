"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  History,
  Save,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type { Patient } from "@gooqi/shared";
import { useApi } from "@/lib/api";
import type { PatientSessionItem } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";

export default function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { request } = useApi();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<PatientSessionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);

  const hydrate = useCallback((p: Patient) => {
    setPatient(p);
    setName(p.name ?? "");
    setPhone(p.phone ?? "");
    setDob(p.dob ?? "");
    setGender(p.gender ?? "");
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        request<{ patient: Patient }>(`/api/patients/${id}`),
        request<{ sessions: PatientSessionItem[] }>(
          `/api/patients/${id}/sessions`,
        ),
      ]);
      hydrate(p.patient);
      setSessions(s.sessions ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patient.");
    }
  }, [id, request, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !!patient &&
    (name !== (patient.name ?? "") ||
      phone !== (patient.phone ?? "") ||
      dob !== (patient.dob ?? "") ||
      gender !== (patient.gender ?? ""));

  async function save() {
    if (name.trim().length === 0) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await request<{ patient: Patient }>(`/api/patients/${id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          phone: phone.trim() || null,
          dob: dob || null,
          gender: gender || null,
        },
      });
      hydrate(res.patient);
      toast.success("Patient updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !patient) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/patients" aria-label="Back to patients">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="size-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Demographics */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="size-4 text-primary" />
              Details
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">Phone</Label>
              <Input
                id="p-phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-dob">Date of birth</Label>
                <Input
                  id="p-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-gender">Gender</Label>
                <Select
                  id="p-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} loading={saving} disabled={!dirty}>
                <Save className="size-4" />
                Save changes
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Visit history */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              Visit history
              {sessions && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({sessions.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardBody>
            {sessions === null ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No visits recorded for this patient yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          {formatDate(s.started_at ?? s.created_at)}
                        </div>
                        <p className="truncate text-sm">
                          {clean(s.chief_complaint) ??
                            clean(s.primary_diagnosis) ??
                            "—"}
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/** Coerce API values that may be null, empty, or the literal string "null". */
function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined")
    return null;
  return t;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
