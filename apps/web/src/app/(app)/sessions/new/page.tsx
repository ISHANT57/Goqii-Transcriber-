"use client";

import { useState } from "react";
import { Check, ShieldCheck, User } from "lucide-react";
import { CONSENT_TEXT_EN, CONSENT_TEXT_HI } from "@gooqi/shared/db";
import { useApi } from "@/lib/api";
import type { CreateSessionResponse } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecordingPanel } from "@/components/recording/RecordingPanel";

type Step = 1 | 2 | 3;
type Lang = "en" | "hi";

export default function NewSessionPage() {
  const { request } = useApi();
  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [language, setLanguage] = useState<Lang>("en");
  const [agreed, setAgreed] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmAndStart() {
    if (!agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await request<CreateSessionResponse>("/api/sessions", {
        method: "POST",
        body: {
          patient: { name: name.trim(), phone: phone.trim() || null },
          consent: { agreed: true, language },
        },
      });
      const id = res.id ?? res.session?.id;
      if (!id) throw new Error("Server did not return a session id.");
      setSessionId(id);
      setStep(3);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create session.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Session</h1>
        <p className="text-sm text-muted-foreground">
          Capture consent, then record the consultation.
        </p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <User className="size-4 text-primary" />
            <CardTitle>Patient details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pt-name">Patient name</Label>
              <Input
                id="pt-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-phone">Phone (optional)</Label>
              <Input
                id="pt-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number"
                inputMode="tel"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={name.trim().length === 0}
              >
                Continue
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Consent
              </CardTitle>
              <div className="flex overflow-hidden rounded-md border border-border text-sm">
                {(["en", "hi"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={cn(
                      "px-3 py-1 transition-colors",
                      language === l
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {l === "en" ? "English" : "हिन्दी"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm">
              {language === "en" ? CONSENT_TEXT_EN : CONSENT_TEXT_HI}
            </p>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                I confirm the patient has been informed and consents to this
                consultation being recorded.
              </span>
            </label>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={confirmAndStart}
                disabled={!agreed}
                loading={submitting}
              >
                {submitting ? "Starting…" : "Confirm & Start Recording"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 3 && sessionId && <RecordingPanel sessionId={sessionId} />}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Patient", "Consent", "Recording"];
  return (
    <ol className="flex items-center">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-success text-success-foreground",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : n}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <span
                className={cn(
                  "mx-3 h-px flex-1 transition-colors",
                  done ? "bg-success" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
