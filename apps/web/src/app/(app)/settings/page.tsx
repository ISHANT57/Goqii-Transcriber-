"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Mail, Save, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { DoctorProfile } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { request } = useApi();

  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  const [clinic, setClinic] = useState("");
  const [saving, setSaving] = useState(false);

  const hydrate = useCallback((d: DoctorProfile) => {
    setProfile(d);
    setName(d.name ?? "");
    setRegistration(d.registration_number ?? "");
    setClinic(d.clinic_name ?? "");
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await request<{ doctor: DoctorProfile; email: string | null }>(
        "/api/doctor/me",
      );
      hydrate(data.doctor);
      setEmail(data.email);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    }
  }, [request, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !!profile &&
    (name !== (profile.name ?? "") ||
      registration !== (profile.registration_number ?? "") ||
      clinic !== (profile.clinic_name ?? ""));

  async function save() {
    if (name.trim().length === 0) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await request<{ doctor: DoctorProfile }>("/api/doctor/me", {
        method: "PATCH",
        body: {
          name: name.trim(),
          registration_number: registration.trim() || null,
          clinic_name: clinic.trim() || null,
        },
      });
      hydrate(res.doctor);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile details appear on generated notes and summaries.
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
            <UserCog className="size-4 text-primary" />
            Doctor profile
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {profile === null ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              {email && (
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                    <Mail className="size-4" />
                    {email}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Full name</Label>
                <Input
                  id="d-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Full Name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-reg">Medical registration number</Label>
                <Input
                  id="d-reg"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value)}
                  placeholder="e.g. MCI/State council no."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-clinic">Clinic name</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="d-clinic"
                    value={clinic}
                    onChange={(e) => setClinic(e.target.value)}
                    placeholder="Clinic / hospital name"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={save} loading={saving} disabled={!dirty}>
                  <Save className="size-4" />
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
