"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Phone, Plus, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { PatientListItem } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PatientsPage() {
  const { request } = useApi();
  const [patients, setPatients] = useState<PatientListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request<{ patients: PatientListItem[] }>(
        "/api/patients",
      );
      setPatients(data.patients ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients.");
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q),
    );
  }, [patients, filter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground">
            Your patient directory and visit history.
          </p>
        </div>
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" />
          Add patient
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name or phone…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {patients === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </span>
          <div>
            <p className="font-medium">
              {patients.length > 0 ? "No patients match your search" : "No patients yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {patients.length > 0
                ? "Try a different name or phone."
                : "Patients are added automatically when you record a session, or add one now."}
            </p>
          </div>
          {patients.length === 0 && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add patient
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Age</th>
                  <th className="px-4 py-3 font-medium">Visits</th>
                  <th className="px-4 py-3 font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="group transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${p.id}`}
                        className="font-medium text-primary group-hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ageFromDob(p.dob) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="teal">{p.session_count}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(p.last_visit_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <Link key={p.id} href={`/patients/${p.id}`}>
                <Card className="p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-primary">{p.name}</span>
                    <Badge tone="teal">{p.session_count} visits</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {p.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" />
                        {p.phone}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {formatDate(p.last_visit_at)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <AddPatientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void load()}
      />
    </div>
  );
}

function AddPatientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { request } = useApi();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (name.trim().length === 0) return;
    setSaving(true);
    try {
      await request("/api/patients", {
        method: "POST",
        body: {
          name: name.trim(),
          phone: phone.trim() || null,
          dob: dob || null,
          gender: gender || null,
        },
      });
      toast.success("Patient added");
      onOpenChange(false);
      setName("");
      setPhone("");
      setDob("");
      setGender("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add patient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add patient</DialogTitle>
          <DialogDescription>
            Create a patient record. You can also just start a session — patients
            are added automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input
              id="np-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-phone">Phone</Label>
              <Input
                id="np-phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-dob">Date of birth</Label>
              <Input
                id="np-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-gender">Gender</Label>
            <Select
              id="np-gender"
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
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={saving}
            disabled={name.trim().length === 0}
          >
            Add patient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ageFromDob(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 150) return null;
  return `${age}y`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
