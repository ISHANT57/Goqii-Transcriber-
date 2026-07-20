"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  FileText,
  MessagesSquare,
  Pill,
  Plus,
  Save,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { SpeakerLabel, Turn } from "@gooqi/shared";
import { useApi } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { COMMON_DRUGS, checkAllergyConflicts, checkDose, checkFrequency } from "@/lib/drugSafety";
import type {
  NoteFields,
  NoteResponse,
  NoteTemplate,
  PrescriptionDraft,
  TranscriptResponse,
} from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignoffDialog, type ReauthProof } from "@/components/review/SignoffDialog";

const SPEAKERS: SpeakerLabel[] = ["doctor", "patient", "other", "unknown"];
const AUTOSAVE_MS = 30_000;

type Tab = "soap" | "rx" | "summary";

function emptyNote(): NoteFields {
  return {
    chief_complaint: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    primary_diagnosis: "",
    differentials: [],
    follow_up: "",
    follow_up_date: null,
    no_medication: false,
  };
}

// The API can legitimately return null for chief_complaint/primary_diagnosis
// (no clinical content identified in the transcript). A plain object spread
// would let that null overwrite emptyNote()'s "" default, and every text
// field below is otherwise assumed to be a non-null string (e.g.
// `note.chief_complaint.trim()` in canSign) — coalesce every string field
// explicitly so a null from the API can never reach a controlled <input> or
// a bare .trim() call.
function normalizeNote(partial: Partial<NoteFields> | null | undefined): NoteFields {
  const merged = { ...emptyNote(), ...(partial ?? {}) };
  return {
    ...merged,
    chief_complaint: merged.chief_complaint ?? "",
    subjective: merged.subjective ?? "",
    objective: merged.objective ?? "",
    assessment: merged.assessment ?? "",
    plan: merged.plan ?? "",
    primary_diagnosis: merged.primary_diagnosis ?? "",
    follow_up: merged.follow_up ?? "",
    differentials: merged.differentials ?? [],
  };
}

function emptyRx(): PrescriptionDraft {
  return {
    drug_name: "",
    dose: "",
    frequency: "",
    duration: "",
    route: "",
    notes: "",
  };
}

export function ReviewEditor({
  sessionId,
  onFinalised,
}: {
  sessionId: string;
  onFinalised: () => void | Promise<unknown>;
}) {
  const { request } = useApi();
  const [signoffOpen, setSignoffOpen] = useState(false);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [note, setNote] = useState<NoteFields>(emptyNote());
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);

  const [tab, setTab] = useState<Tab>("soap");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [doctorName, setDoctorName] = useState<string>("Doctor");
  const [signing, setSigning] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Keep a ref of the latest state to avoid stale closures in autosave/blur callbacks.
  const stateRef = useRef({ note, prescriptions, turns });
  useEffect(() => {
    stateRef.current = { note, prescriptions, turns };
  }, [note, prescriptions, turns]);

  // --- Load doctor name --------------------------------------------------
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as
        | Record<string, unknown>
        | undefined;
      const name =
        (meta?.full_name as string | undefined) ??
        (meta?.name as string | undefined) ??
        (data.user?.email ? data.user.email.split("@")[0] : undefined);
      if (name) setDoctorName(name);
    });
  }, []);

  // --- Initial load ------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tx, n] = await Promise.all([
        request<TranscriptResponse>(`/api/sessions/${sessionId}/transcript`),
        request<NoteResponse>(`/api/sessions/${sessionId}/note`),
      ]);
      setTurns(tx?.turns ?? []);
      setNote(normalizeNote(n?.note));
      setPrescriptions(n?.prescriptions ?? []);
      setSummary(n?.summary ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [request, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // --- Note templates ("macros") ------------------------------------------
  useEffect(() => {
    request<{ templates: NoteTemplate[] }>("/api/templates")
      .then((res) => setTemplates(res.templates ?? []))
      .catch(() => { });
  }, [request]);

  function applyTemplate(t: NoteTemplate) {
    setNote((n) => ({
      ...n,
      chief_complaint: t.chief_complaint ?? n.chief_complaint,
      subjective: t.subjective ?? n.subjective,
      objective: t.objective ?? n.objective,
      assessment: t.assessment ?? n.assessment,
      plan: t.plan ?? n.plan,
      follow_up: t.follow_up ?? n.follow_up,
    }));
    markDirty();
    toast.success(`Loaded template "${t.name}"`);
  }

  async function saveAsTemplate() {
    const name = window.prompt("Template name (e.g. \"URI follow-up\"):")?.trim();
    if (!name) return;
    try {
      const res = await request<{ template: NoteTemplate }>("/api/templates", {
        method: "POST",
        body: {
          name,
          chief_complaint: note.chief_complaint,
          subjective: note.subjective,
          objective: note.objective,
          assessment: note.assessment,
          plan: note.plan,
          follow_up: note.follow_up,
        },
      });
      setTemplates((ts) => [...ts, res.template].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Saved template "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template.");
    }
  }

  async function deleteTemplate(t: NoteTemplate) {
    try {
      await request(`/api/templates/${t.id}`, { method: "DELETE" });
      setTemplates((ts) => ts.filter((x) => x.id !== t.id));
      toast.success(`Deleted template "${t.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete template.");
    }
  }

  // --- Saving ------------------------------------------------------------
  const save = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaving(true);
    try {
      const current = stateRef.current;
      await request(`/api/sessions/${sessionId}/note`, {
        method: "PATCH",
        body: {
          ...current.note,
          prescriptions: current.prescriptions,
          no_medication: current.note.no_medication,
        },
      });
      // Best-effort transcript persistence (separate resource).
      await request(`/api/sessions/${sessionId}/transcript`, {
        method: "PATCH",
        body: { turns: current.turns },
      }).catch(() => { });
      dirtyRef.current = false;
      setDirty(false);
      setSavedAt(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [request, sessionId]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  // Save on blur (immediate flush).
  const flushSave = useCallback(() => {
    if (dirtyRef.current) void save();
  }, [save]);

  // Warn before unload if unsaved.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // --- Field updaters ----------------------------------------------------
  function setNoteField<K extends keyof NoteFields>(key: K, value: NoteFields[K]) {
    setNote((n) => ({ ...n, [key]: value }));
    markDirty();
  }

  function updateTurn(i: number, patch: Partial<Turn>) {
    setTurns((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
    markDirty();
  }

  // Diarization role assignment is a best-effort guess (providers label speakers
  // by first-appearance order and we map speaker 0 → doctor); if the patient
  // spoke first the whole transcript comes back with doctor/patient inverted.
  // One click flips every doctor↔patient label so the doctor doesn't have to
  // reassign each turn individually.
  function swapDoctorPatient() {
    setTurns((ts) =>
      ts.map((t) =>
        t.speaker === "doctor"
          ? { ...t, speaker: "patient" }
          : t.speaker === "patient"
            ? { ...t, speaker: "doctor" }
            : t,
      ),
    );
    markDirty();
  }

  function updateRx(i: number, patch: Partial<PrescriptionDraft>) {
    setPrescriptions((rx) =>
      rx.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
    markDirty();
  }
  function addRx() {
    setPrescriptions((rx) => [...rx, emptyRx()]);
    markDirty();
  }
  function removeRx(i: number) {
    setPrescriptions((rx) => rx.filter((_, idx) => idx !== i));
    markDirty();
  }

  const allergyWarnings = useMemo(
    () => checkAllergyConflicts(note.subjective, prescriptions),
    [note.subjective, prescriptions],
  );

  // --- Sign-off gating ---------------------------------------------------
  const hasValidRx = prescriptions.some(
    (r) => r.drug_name.trim().length > 0,
  );
  const canSign =
    note.chief_complaint.trim().length > 0 &&
    note.primary_diagnosis.trim().length > 0 &&
    (note.no_medication || hasValidRx);

  // Re-authenticated sign-off: the SignoffDialog mints a fresh access token by
  // re-authenticating the doctor, which we pass to the API as signature proof.
  async function completeSignoff(proof: ReauthProof) {
    setSigning(true);
    try {
      if (dirtyRef.current) await save();
      await request(`/api/sessions/${sessionId}/signoff`, {
        method: "POST",
        body: { reauth_access_token: proof.token, reauth_method: proof.method },
      });
      toast.success("Note finalised");
      await onFinalised();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-off failed.";
      setError(msg);
      toast.error(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Save status bar */}
      <div className="sticky top-14 z-30 flex items-center justify-between rounded-md border border-border bg-card/90 px-4 py-2 text-sm backdrop-blur">
        <div className="flex items-center gap-2 text-muted-foreground">
          {saving ? (
            <>
              <Save className="size-4 animate-pulse" />
              Saving…
            </>
          ) : dirty ? (
            <>
              <span className="size-2 rounded-full bg-warning" />
              Unsaved changes
            </>
          ) : savedAt ? (
            <>
              <CheckCircle2 className="size-4 text-success" />
              Saved {savedAt}
            </>
          ) : (
            "Auto-saves as you edit"
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void save()}>
            <Save className="size-4" />
            Save now
          </Button>
          <Button
            size="sm"
            onClick={() => setSignoffOpen(true)}
            disabled={!canSign}
            loading={signing}
            title={
              canSign
                ? undefined
                : "Chief complaint, primary diagnosis, and at least one prescription (or 'No medication') are required."
            }
          >
            <UserRoundCheck className="size-4" />
            {signing ? "Finalising…" : "Sign & Finalise"}
          </Button>
        </div>
      </div>

      {!canSign && (
        <p className="text-xs text-muted-foreground">
          To finalise: add a chief complaint, a primary diagnosis, and at least
          one prescription (or tick “No medication”).
        </p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {allergyWarnings.length > 0 && (
        <div className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {allergyWarnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT: transcript */}
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessagesSquare className="size-4 text-primary" />
              Transcript
            </CardTitle>
            {turns.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={swapDoctorPatient}
                title="Flip all doctor and patient labels (use if speakers are reversed)"
              >
                Swap doctor / patient
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-3">
            {turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transcript turns.
              </p>
            ) : (
              turns.map((t, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-muted/40 p-3"
                >
                  <div className="mb-2 w-36">
                    <Select
                      value={t.speaker}
                      onChange={(e) =>
                        updateTurn(i, {
                          speaker: e.target.value as SpeakerLabel,
                        })
                      }
                      onBlur={flushSave}
                      className="h-8 capitalize text-xs"
                    >
                      {SPEAKERS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Textarea
                    value={t.text}
                    rows={2}
                    onChange={(e) => updateTurn(i, { text: e.target.value })}
                    onBlur={flushSave}
                  />
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* RIGHT: tabs */}
        <Card className="h-fit">
          <CardBody>
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList className="w-full">
                <TabsTrigger value="soap" className="flex-1">
                  <FileText className="size-4" />
                  SOAP
                </TabsTrigger>
                <TabsTrigger value="rx" className="flex-1">
                  <Pill className="size-4" />
                  Rx
                </TabsTrigger>
                <TabsTrigger value="summary" className="flex-1">
                  <MessagesSquare className="size-4" />
                  Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="soap">
                <div className="mb-3 flex justify-end">
                  <TemplatesMenu
                    templates={templates}
                    onApply={applyTemplate}
                    onSave={saveAsTemplate}
                    onDelete={deleteTemplate}
                  />
                </div>
                <SoapFields note={note} onField={setNoteField} onBlur={flushSave} />
              </TabsContent>

              <TabsContent value="rx">
                <RxTable
                  prescriptions={prescriptions}
                  noMedication={note.no_medication}
                  onToggleNoMed={(v) => setNoteField("no_medication", v)}
                  onUpdate={updateRx}
                  onAdd={addRx}
                  onRemove={removeRx}
                  onBlur={flushSave}
                />
              </TabsContent>

              <TabsContent value="summary">
                {summary ? (
                  <p className="whitespace-pre-wrap text-sm">{summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The plain-language patient summary is generated when you{" "}
                    <strong>Sign &amp; Finalise</strong>. You can then review,
                    edit, and print it.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardBody>
        </Card>
      </div>

      <SignoffDialog
        open={signoffOpen}
        onOpenChange={setSignoffOpen}
        doctorName={doctorName}
        onConfirmed={completeSignoff}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SoapFields({
  note,
  onField,
  onBlur,
}: {
  note: NoteFields;
  onField: <K extends keyof NoteFields>(k: K, v: NoteFields[K]) => void;
  onBlur: () => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Chief complaint">
        <Input
          value={note.chief_complaint}
          onChange={(e) => onField("chief_complaint", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Subjective">
        <Textarea
          rows={3}
          value={note.subjective}
          onChange={(e) => onField("subjective", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Objective">
        <Textarea
          rows={3}
          value={note.objective}
          onChange={(e) => onField("objective", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Assessment">
        <Textarea
          rows={3}
          value={note.assessment}
          onChange={(e) => onField("assessment", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Plan">
        <Textarea
          rows={3}
          value={note.plan}
          onChange={(e) => onField("plan", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Primary diagnosis">
        <Input
          value={note.primary_diagnosis}
          onChange={(e) => onField("primary_diagnosis", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Differentials (one per line)">
        <Textarea
          rows={2}
          value={note.differentials.join("\n")}
          onChange={(e) =>
            onField(
              "differentials",
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          onBlur={onBlur}
        />
      </Field>
      <Field label="Follow-up">
        <Textarea
          rows={2}
          value={note.follow_up}
          onChange={(e) => onField("follow_up", e.target.value)}
          onBlur={onBlur}
        />
      </Field>
      <Field label="Follow-up date (optional — shows on the Follow-ups panel)">
        <Input
          type="date"
          value={note.follow_up_date ?? ""}
          onChange={(e) => onField("follow_up_date", e.target.value || null)}
          onBlur={onBlur}
        />
      </Field>
    </div>
  );
}

function TemplatesMenu({
  templates,
  onApply,
  onSave,
  onDelete,
}: {
  templates: NoteTemplate[];
  onApply: (t: NoteTemplate) => void;
  onSave: () => void;
  onDelete: (t: NoteTemplate) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Bookmark className="size-4" />
          Templates
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case">
          Load a saved template
        </DropdownMenuLabel>
        {templates.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No templates saved yet.
          </div>
        ) : (
          templates.map((t) => (
            <DropdownMenuItem
              key={t.id}
              className="justify-between gap-2"
              onSelect={(e) => {
                e.preventDefault();
                onApply(t);
              }}
            >
              <span className="truncate">{t.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t);
                }}
                aria-label={`Delete template ${t.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSave}>
          <Plus className="size-4" />
          Save current SOAP as template
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RxTable({
  prescriptions,
  noMedication,
  onToggleNoMed,
  onUpdate,
  onAdd,
  onRemove,
  onBlur,
}: {
  prescriptions: PrescriptionDraft[];
  noMedication: boolean;
  onToggleNoMed: (v: boolean) => void;
  onUpdate: (i: number, patch: Partial<PrescriptionDraft>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onBlur: () => void;
}) {
  const cols: [keyof PrescriptionDraft, string][] = [
    ["drug_name", "Drug"],
    ["dose", "Dose"],
    ["frequency", "Frequency"],
    ["duration", "Duration"],
    ["route", "Route"],
    ["notes", "Notes"],
  ];
  return (
    <div className="space-y-3">
      {/* Shared datalist for drug-name autocomplete (advisory only — any
          value can still be typed; this isn't a restrictive formulary). */}
      <datalist id="common-drugs">
        {COMMON_DRUGS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[hsl(var(--primary))]"
          checked={noMedication}
          onChange={(e) => onToggleNoMed(e.target.checked)}
        />
        No medication prescribed
      </label>

      {!noMedication && (
        <>
          <div className="space-y-3">
            {prescriptions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No prescriptions. Add one below.
              </p>
            )}
            {prescriptions.map((r, i) => {
              const doseWarning = checkDose(r.dose ?? "");
              const freqWarning = checkFrequency(r.frequency ?? "");
              return (
                <div
                  key={i}
                  className="space-y-2 rounded-md border border-border p-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {cols.map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-[11px] uppercase text-muted-foreground">
                          {label}
                        </Label>
                        <Input
                          value={r[key] ?? ""}
                          list={key === "drug_name" ? "common-drugs" : undefined}
                          onChange={(e) =>
                            onUpdate(i, {
                              [key]: e.target.value,
                            } as Partial<PrescriptionDraft>)
                          }
                          onBlur={onBlur}
                        />
                        {key === "dose" && doseWarning && (
                          <p className="text-[11px] text-warning">
                            ⚠ {doseWarning}
                          </p>
                        )}
                        {key === "frequency" && freqWarning && (
                          <p className="text-[11px] text-warning">
                            ⚠ {freqWarning}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => onRemove(i)}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="secondary" onClick={onAdd}>
            <Plus className="size-4" />
            Add medication
          </Button>
        </>
      )}
    </div>
  );
}
