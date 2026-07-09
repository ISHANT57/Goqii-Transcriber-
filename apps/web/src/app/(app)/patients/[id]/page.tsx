"use client";

import { use, useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  History,
  Save,
  Stethoscope,
  UserRound,
  Heart,
  FlaskConical,
  Pill,
  DollarSign,
  AlertCircle,
  UploadCloud,
  Star,
  Bookmark,
  ShieldCheck,
  FileText,
  Trash2,
  FileUp,
  Activity,
  ChevronRight,
  Plus,
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
import { cn } from "@/lib/cn";

type TimelineFilter = "all" | "consultations" | "vitals" | "labs" | "prescriptions" | "billing";

interface LabReport {
  id: string;
  name: string;
  date: string;
  size: string;
  category: string;
}

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

  // Demographics state (tied to database!)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);

  // Patient 360 UI States
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "edit">("overview");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [bookmarkedSessions, setBookmarkedSessions] = useState<Set<string>>(new Set());
  const [doctorNotes, setDoctorNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Custom states for local extensions (vitals, billing, insurance, attachments)
  const [uploadedReports, setUploadedReports] = useState<LabReport[]>([]);
  const [vitalsHistory, setVitalsHistory] = useState<{
    date: string;
    bp: string;
    hr: number;
    temp: number;
    spo2: number;
    weight: number;
  }[]>([]);
  const [billingHistory, setBillingHistory] = useState<{
    id: string;
    date: string;
    service: string;
    amount: string;
    status: string;
  }[]>([]);
  const [emergencyContact, setEmergencyContact] = useState({
    name: "",
    relation: "",
    phone: ""
  });
  const [insurance, setInsurance] = useState({
    provider: "",
    policyNum: "",
    status: ""
  });

  // Temporary edit states for local medical profile & additions
  const [ecName, setEcName] = useState("");
  const [ecRelation, setEcRelation] = useState("");
  const [ecPhone, setEcPhone] = useState("");

  const [insProvider, setInsProvider] = useState("");
  const [insPolicy, setInsPolicy] = useState("");
  const [insStatus, setInsStatus] = useState("");

  const [newBp, setNewBp] = useState("");
  const [newHr, setNewHr] = useState("");
  const [newTemp, setNewTemp] = useState("");
  const [newSpo2, setNewSpo2] = useState("");
  const [newWeight, setNewWeight] = useState("");

  const [newService, setNewService] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newStatus, setNewStatus] = useState("paid");

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

      // Load saved doctor notes from localStorage for this patient
      const storedNotes = localStorage.getItem(`doc_notes_${id}`);
      if (storedNotes) setDoctorNotes(storedNotes);

      // Load bookmarked sessions
      const storedBookmarks = localStorage.getItem(`bookmarks_${id}`);
      if (storedBookmarks) {
        setBookmarkedSessions(new Set(JSON.parse(storedBookmarks)));
      }

      // Load extended patient info from localStorage
      const storedExtInfo = localStorage.getItem(`patient_ext_info_${id}`);
      if (storedExtInfo) {
        const parsed = JSON.parse(storedExtInfo);
        if (parsed.uploadedReports) setUploadedReports(parsed.uploadedReports);
        if (parsed.vitalsHistory) setVitalsHistory(parsed.vitalsHistory);
        if (parsed.billingHistory) setBillingHistory(parsed.billingHistory);
        if (parsed.emergencyContact) {
          setEmergencyContact(parsed.emergencyContact);
          setEcName(parsed.emergencyContact.name ?? "");
          setEcRelation(parsed.emergencyContact.relation ?? "");
          setEcPhone(parsed.emergencyContact.phone ?? "");
        }
        if (parsed.insurance) {
          setInsurance(parsed.insurance);
          setInsProvider(parsed.insurance.provider ?? "");
          setInsPolicy(parsed.insurance.policyNum ?? "");
          setInsStatus(parsed.insurance.status ?? "");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patient.");
    }
  }, [id, request, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Save doctor personal notes locally
  const handleSaveDoctorNotes = () => {
    localStorage.setItem(`doc_notes_${id}`, doctorNotes);
    toast.success("Doctor personal notes updated");
  };

  // Toggle bookmarked session
  const toggleBookmark = (sessionId: string) => {
    const updated = new Set(bookmarkedSessions);
    if (updated.has(sessionId)) {
      updated.delete(sessionId);
      toast.success("Removed bookmark from consultation");
    } else {
      updated.add(sessionId);
      toast.success("Bookmarked consultation");
    }
    setBookmarkedSessions(updated);
    localStorage.setItem(`bookmarks_${id}`, JSON.stringify(Array.from(updated)));
  };

  // Simulate file uploading
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploading(true);
    setTimeout(() => {
      const newReport: LabReport = {
        id: String(Date.now()),
        name: file.name,
        date: new Date().toISOString().split("T")[0],
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        category: "Uploaded Attachment"
      };
      setUploadedReports(prev => {
        const next = [newReport, ...prev];
        const current = localStorage.getItem(`patient_ext_info_${id}`);
        const parsed = current ? JSON.parse(current) : {};
        parsed.uploadedReports = next;
        localStorage.setItem(`patient_ext_info_${id}`, JSON.stringify(parsed));
        return next;
      });
      setIsUploading(false);
      toast.success(`Successfully uploaded ${file.name}`);
    }, 1500);
  };

  // Save emergency contact and insurance details
  const saveMedicalProfile = () => {
    const updatedEc = { name: ecName.trim(), relation: ecRelation.trim(), phone: ecPhone.trim() };
    const updatedIns = { provider: insProvider.trim(), policyNum: insPolicy.trim(), status: insStatus.trim() };
    setEmergencyContact(updatedEc);
    setInsurance(updatedIns);
    const current = localStorage.getItem(`patient_ext_info_${id}`);
    const parsed = current ? JSON.parse(current) : {};
    parsed.emergencyContact = updatedEc;
    parsed.insurance = updatedIns;
    localStorage.setItem(`patient_ext_info_${id}`, JSON.stringify(parsed));
    toast.success("Emergency contact and insurance details updated");
  };

  // Add vital logs
  const addVitalsEntry = () => {
    if (!newBp && !newHr && !newTemp && !newSpo2 && !newWeight) {
      toast.error("Please fill in at least one vital parameter.");
      return;
    }
    const entry = {
      date: new Date().toISOString().split("T")[0],
      bp: newBp.trim() || "—",
      hr: newHr ? parseInt(newHr) : 0,
      temp: newTemp ? parseFloat(newTemp) : 0,
      spo2: newSpo2 ? parseInt(newSpo2) : 0,
      weight: newWeight ? parseFloat(newWeight) : 0,
    };
    const nextList = [entry, ...vitalsHistory];
    setVitalsHistory(nextList);
    const current = localStorage.getItem(`patient_ext_info_${id}`);
    const parsed = current ? JSON.parse(current) : {};
    parsed.vitalsHistory = nextList;
    localStorage.setItem(`patient_ext_info_${id}`, JSON.stringify(parsed));
    setNewBp("");
    setNewHr("");
    setNewTemp("");
    setNewSpo2("");
    setNewWeight("");
    toast.success("Vitals entry added");
  };

  // Add billing invoices
  const addBillingEntry = () => {
    if (!newService.trim() || !newAmount.trim()) {
      toast.error("Service description and amount are required.");
      return;
    }
    const entry = {
      id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split("T")[0],
      service: newService.trim(),
      amount: newAmount.trim(),
      status: newStatus,
    };
    const nextList = [entry, ...billingHistory];
    setBillingHistory(nextList);
    const current = localStorage.getItem(`patient_ext_info_${id}`);
    const parsed = current ? JSON.parse(current) : {};
    parsed.billingHistory = nextList;
    localStorage.setItem(`patient_ext_info_${id}`, JSON.stringify(parsed));
    setNewService("");
    setNewAmount("");
    setNewStatus("paid");
    toast.success("Billing invoice generated");
  };

  // Calculations for DOB/Age
  const ageStr = useMemo(() => {
    return ageFromDob(patient?.dob ?? dob) ?? "—";
  }, [patient, dob]);

  // Compile timeline nodes (Epic EMR Style)
  const timelineNodes = useMemo(() => {
    const nodes: {
      id: string;
      date: string;
      title: string;
      desc: string;
      type: "consultation" | "vitals" | "lab" | "prescription" | "billing";
      meta?: string;
      isBookmarked?: boolean;
      sessionId?: string;
    }[] = [];

    // 1. Consultations (sessions)
    if (sessions) {
      sessions.forEach(s => {
        const isBookmarked = bookmarkedSessions.has(s.id);
        nodes.push({
          id: `session-${s.id}`,
          date: s.started_at ?? s.created_at ?? "",
          title: "Outpatient Consultation",
          desc: clean(s.chief_complaint) ?? "General outpatient visit and EMR review.",
          type: "consultation",
          meta: clean(s.primary_diagnosis) ? `Diagnosis: ${s.primary_diagnosis}` : undefined,
          isBookmarked,
          sessionId: s.id
        });

        // If prescription exists in session, compile prescription node
        if (s.status === "final") {
          nodes.push({
            id: `rx-${s.id}`,
            date: s.started_at ?? s.created_at ?? "",
            title: "Prescription Signed",
            desc: "Generated clinical prescription signed off & pharmacy notified.",
            type: "prescription",
            sessionId: s.id
          });
        }
      });
    }

    // 2. Vitals entries
    vitalsHistory.forEach((v, index) => {
      nodes.push({
        id: `vitals-${index}`,
        date: v.date,
        title: "Clinical Vitals Recorded",
        desc: `BP: ${v.bp} mmHg • HR: ${v.hr} BPM • SpO2: ${v.spo2}% • Temp: ${v.temp}°F • Weight: ${v.weight} kg`,
        type: "vitals"
      });
    });

    // 3. Lab reports
    uploadedReports.forEach(r => {
      nodes.push({
        id: `lab-${r.id}`,
        date: r.date,
        title: "Lab Report Uploaded",
        desc: `${r.name} (${r.size}) categorized as ${r.category}.`,
        type: "lab"
      });
    });

    // 4. Billing entries
    billingHistory.forEach(b => {
      nodes.push({
        id: `billing-${b.id}`,
        date: b.date,
        title: "Billing Invoice Generated",
        desc: `${b.service} - Amount ${b.amount} collected.`,
        type: "billing",
        meta: `Invoice Status: ${b.status.toUpperCase()}`
      });
    });

    // Sort nodes descending by date
    return nodes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, bookmarkedSessions, vitalsHistory, uploadedReports, billingHistory]);

  // Filtered timeline nodes
  const filteredTimelineNodes = useMemo(() => {
    if (timelineFilter === "all") return timelineNodes;
    if (timelineFilter === "consultations") return timelineNodes.filter(n => n.type === "consultation");
    if (timelineFilter === "vitals") return timelineNodes.filter(n => n.type === "vitals");
    if (timelineFilter === "labs") return timelineNodes.filter(n => n.type === "lab");
    if (timelineFilter === "prescriptions") return timelineNodes.filter(n => n.type === "prescription");
    if (timelineFilter === "billing") return timelineNodes.filter(n => n.type === "billing");
    return timelineNodes;
  }, [timelineNodes, timelineFilter]);

  // Demographic edit state check (PATCH verification)
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
      toast.success("Patient demographics updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save updates.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !patient) {
    return (
      <Card className="bg-iris-shadow/40 border border-white/[0.08] p-6 rounded-cards">
        <CardBody className="space-y-4 text-center">
          <AlertCircle className="size-8 text-destructive mx-auto" />
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
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-white/[0.05]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-[400px] lg:col-span-4 bg-white/[0.05]" />
          <Skeleton className="h-[400px] lg:col-span-8 bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-foreground">
      {/* Patient Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground shrink-0">
            <Link href="/patients" aria-label="Back to patients">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <UserRound className="size-4 sm:size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{patient.name}</h1>
              <span className="text-xs bg-muted text-muted-foreground/80 px-2 py-0.5 rounded-tags shrink-0">ID: #{patient.id.slice(0, 8)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {gender.toUpperCase() || "UNSPECIFIED"} • {ageStr} years old • DOB: {dob || "—"}
            </p>
          </div>
        </div>

        {/* Quick action controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          <Button asChild className="rounded-buttons bg-primary hover:bg-primary/90 text-primary-foreground border border-border w-full sm:w-auto">
            <Link href={`/sessions/new?patient=${encodeURIComponent(patient.name)}`}>
              <Plus className="size-4" />
              New Consultation
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Tabs System */}
      <div className="flex border-b border-border p-1 gap-1 sm:gap-2 w-full sm:max-w-lg bg-muted/50 rounded-inputs overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-inputs transition-all duration-300",
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          Overview &amp; Vitals
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-inputs transition-all duration-300",
            activeTab === "timeline"
              ? "bg-primary text-primary-foreground shadow border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          Medical Timeline
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-inputs transition-all duration-300",
            activeTab === "edit"
              ? "bg-primary text-primary-foreground shadow border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          Demographics &amp; Edit
        </button>
      </div>

      {/* Profile Layout Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">

        {/* Left Sidebar Profile Widgets (4 columns) */}
        <div className="xl:col-span-4 space-y-6">

          {/* Quick Demographics Sidebar Card */}
          <Card className="bg-card border border-border p-5 rounded-cards backdrop-blur-md">
            <div className="text-center pb-4 border-b border-border">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold border border-primary/20 mx-auto mb-2.5">
                {(patient.name || "?")[0].toUpperCase()}
              </span>
              <h3 className="font-bold text-base text-foreground">{patient.name}</h3>
              <span className="text-xs text-muted-foreground font-mono">{phone || "No phone added"}</span>
            </div>

            <div className="space-y-3.5 pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emergency Contact</span>
                <span className="font-semibold text-right text-foreground">
                  {emergencyContact.name ? (
                    <>
                      {emergencyContact.name} ({emergencyContact.relation}) <br />
                      <span className="text-[10px] text-muted-foreground font-mono">{emergencyContact.phone}</span>
                    </>
                  ) : (
                    "Not provided"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Insurance Network</span>
                <span className="font-semibold text-right text-foreground">
                  {insurance.provider ? (
                    <>
                      {insurance.provider} <br />
                      <span className="text-[10px] text-muted-foreground font-mono">{insurance.policyNum}</span>
                    </>
                  ) : (
                    "Not provided"
                  )}
                </span>
              </div>
              {insurance.status && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Insurance Status</span>
                  <span className="text-success bg-success/15 px-2 py-0.5 rounded-tags font-semibold border border-success/20 uppercase text-[9px] tracking-wide">
                    {insurance.status}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Doctor Personal Notes Card */}
          <Card className="bg-card border border-border p-5 rounded-cards backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3.5">
              <h3 className="text-sm font-semibold text-foreground">Internal Doctor Notes</h3>
              <button
                onClick={handleSaveDoctorNotes}
                className="text-xs text-primary hover:underline"
              >
                Save
              </button>
            </div>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Type persistent private clinical observation notes, precautions, or special treatment follow-ups here. Saved locally..."
              className="w-full h-32 bg-muted/40 border border-border focus:border-primary rounded-lg p-3 text-xs placeholder:text-muted-foreground/60 text-foreground focus:ring-0 focus:outline-none resize-none"
            />
          </Card>

          {/* AI Clinical Insights & Risk Indicators */}
          <Card className="bg-card border border-border p-5 rounded-cards backdrop-blur-md">
            <div className="flex items-center gap-2 border-b border-border pb-3 mb-3.5">
              <Activity className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Assistant Insights</h3>
            </div>

            <div className="space-y-3.5 text-xs text-muted-foreground py-2 text-center">
              <p>No AI insights generated yet. AI recommendations and risk warnings will compile automatically once consultations are transcribed.</p>
            </div>
          </Card>

        </div>

        {/* Right Main Profile Content (8 columns) */}
        <div className="xl:col-span-8">

          {/* TAB 1: OVERVIEW & VITALS */}
          {activeTab === "overview" && (
            <div className="space-y-6">

              {/* Vitals Dashboard */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Latest Recorded Vitals</h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {vitalsHistory[0] ? `Last update: ${formatDate(vitalsHistory[0].date)}` : "No vitals recorded"}
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-muted/40 border border-border p-3.5 rounded-lg text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Blood Pressure</span>
                    <span className="text-base font-bold text-foreground block mt-1">{vitalsHistory[0]?.bp || "—"}</span>
                    {vitalsHistory[0]?.bp && vitalsHistory[0]?.bp !== "—" && (
                      <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded-tags mt-1 inline-block">Recorded</span>
                    )}
                  </div>

                  <div className="bg-muted/40 border border-border p-3.5 rounded-lg text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Heart Rate</span>
                    <span className="text-base font-bold text-foreground block mt-1">
                      {vitalsHistory[0]?.hr ? `${vitalsHistory[0].hr} bpm` : "—"}
                    </span>
                    {vitalsHistory[0]?.hr ? (
                      <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded-tags mt-1 inline-block">Resting</span>
                    ) : null}
                  </div>

                  <div className="bg-muted/40 border border-border p-3.5 rounded-lg text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">SpO2 Level</span>
                    <span className="text-base font-bold text-foreground block mt-1">
                      {vitalsHistory[0]?.spo2 ? `${vitalsHistory[0].spo2}%` : "—"}
                    </span>
                    {vitalsHistory[0]?.spo2 ? (
                      <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded-tags mt-1 inline-block">Optimal</span>
                    ) : null}
                  </div>

                  <div className="bg-muted/40 border border-border p-3.5 rounded-lg text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Body Temp</span>
                    <span className="text-base font-bold text-foreground block mt-1">
                      {vitalsHistory[0]?.temp ? `${vitalsHistory[0].temp} °F` : "—"}
                    </span>
                    {vitalsHistory[0]?.temp ? (
                      <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded-tags mt-1 inline-block">Apyrexial</span>
                    ) : null}
                  </div>
                </div>
              </Card>

              {/* Consultation History Summary */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Recent Consultation Documents</h3>
                  <button
                    onClick={() => setActiveTab("timeline")}
                    className="text-xs text-primary hover:underline"
                  >
                    View Timeline
                  </button>
                </div>

                {sessions === null ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full bg-muted" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No recorded consultations found for this patient.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.slice(0, 3).map(s => (
                      <div key={s.id} className="bg-muted/20 border border-border/50 rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CalendarDays className="size-3.5 text-primary" />
                            {formatDate(s.started_at ?? s.created_at)}
                            {bookmarkedSessions.has(s.id) && (
                              <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            )}
                          </div>
                          <p className="font-semibold text-sm text-foreground mt-1">
                            Complaint: {clean(s.chief_complaint) ?? "General visit checkup"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-lg">
                            Diagnosis: {clean(s.primary_diagnosis) ?? "Evaluating symptoms"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button asChild size="sm" variant="secondary" className="rounded-lg bg-muted border border-border hover:bg-muted/80 text-muted-foreground">
                            <Link href={`/sessions/${s.id}`}>
                              Open File
                            </Link>
                          </Button>
                          <button
                            onClick={() => toggleBookmark(s.id)}
                            className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-amber-500 transition-colors"
                          >
                            <Bookmark className={cn("size-4", bookmarkedSessions.has(s.id) && "fill-amber-400 text-amber-400")} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Billing Invoice Logs */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Financial &amp; Billing History</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground/80 pb-2">
                        <th className="py-2 font-semibold">Invoice ID</th>
                        <th className="py-2 font-semibold">Date</th>
                        <th className="py-2 font-semibold">Service Description</th>
                        <th className="py-2 font-semibold">Amount</th>
                        <th className="py-2 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {billingHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground text-xs">
                            No billing invoices found. Use the Edit tab to record invoice records.
                          </td>
                        </tr>
                      ) : (
                        billingHistory.map(b => (
                          <tr key={b.id} className="text-foreground">
                            <td className="py-3 font-mono font-semibold">{b.id}</td>
                            <td className="py-3">{b.date}</td>
                            <td className="py-3 text-muted-foreground/80">{b.service}</td>
                            <td className="py-3 font-semibold">{b.amount}</td>
                            <td className="py-3 text-right">
                              <span className="text-success bg-success/15 px-2 py-0.5 rounded font-semibold border border-success/20 uppercase text-[9px]">
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          )}

          {/* TAB 2: MEDICAL TIMELINE (EPIC EMR STYLE) */}
          {activeTab === "timeline" && (
            <div className="space-y-6 animate-fade-in">

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 bg-muted border border-border p-2 rounded-cards">
                {(["all", "consultations", "vitals", "labs", "prescriptions", "billing"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTimelineFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded-tags text-xs font-medium uppercase tracking-wide transition-all border",
                      timelineFilter === f
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Lab Reports & Attachments Dragzone */}
              <Card className="bg-card border border-border p-5 rounded-cards backdrop-blur-md">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-sm font-semibold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                      <FileUp className="size-4 text-primary" />
                      Add Laboratory Reports &amp; EMR Attachments
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">PDFs, image scans, and lab results can be uploaded directly to this patient&apos;s profile.</p>
                  </div>

                  <div className="relative shrink-0 w-full sm:w-auto">
                    <input
                      type="file"
                      id="emr-attachment-upload"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="emr-attachment-upload"
                      className={cn(
                        "flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 border border-border text-muted-foreground hover:text-foreground text-xs font-bold rounded-buttons px-4 py-2.5 transition-all cursor-pointer",
                        isUploading && "opacity-50"
                      )}
                    >
                      {isUploading ? (
                        <>
                          <Activity className="size-4 animate-spin text-primary" />
                          <span>Uploading File...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-4 text-primary" />
                          <span>Choose Lab File</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </Card>

              {/* Epic EMR Timeline Tree */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="border-b border-border pb-4 mb-6">
                  <h3 className="text-sm font-semibold text-foreground">Comprehensive EMR Timeline</h3>
                </div>

                <div className="relative pl-6 border-l border-border space-y-6">
                  {filteredTimelineNodes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No timeline events match the selected filter.</p>
                  ) : (
                    filteredTimelineNodes.map(node => {
                      // Determine Node Icon & Color
                      let Icon = Stethoscope;
                      let colorClass = "bg-primary/10 text-primary border-primary/20";

                      if (node.type === "vitals") {
                        Icon = Heart;
                        colorClass = "bg-destructive/10 text-destructive border-destructive/20";
                      } else if (node.type === "lab") {
                        Icon = FlaskConical;
                        colorClass = "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
                      } else if (node.type === "prescription") {
                        Icon = Pill;
                        colorClass = "bg-success/10 text-success border-success/20";
                      } else if (node.type === "billing") {
                        Icon = DollarSign;
                        colorClass = "bg-primary/10 text-primary border-primary/20";
                      }

                      return (
                        <div key={node.id} className="relative group text-foreground">
                           {/* Left node point */}
                          <span className={cn(
                            "absolute -left-[37px] top-1 flex size-5 items-center justify-center rounded-full border text-[9px] shadow-sm font-semibold bg-background",
                            colorClass
                          )}>
                            <Icon className="size-2.5" />
                          </span>

                          {/* Detail Card */}
                          <div className={cn(
                            "bg-muted/20 border border-border/80 group-hover:border-border p-4 rounded-lg transition-all",
                            node.isBookmarked && "border-amber-500/35 bg-amber-500/[0.02]"
                          )}>
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <span className="text-[10px] text-muted-foreground font-mono block">
                                  {formatDate(node.date)}
                                </span>
                                <h4 className="font-semibold text-sm text-foreground mt-0.5 flex items-center gap-1.5">
                                  {node.title}
                                  {node.isBookmarked && (
                                    <Star className="size-3 fill-amber-400 text-amber-400" />
                                  )}
                                </h4>
                              </div>

                              {node.type === "consultation" && node.sessionId && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleBookmark(node.sessionId!)}
                                    className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-amber-500 transition-colors"
                                  >
                                    <Bookmark className={cn("size-3.5", node.isBookmarked && "fill-amber-400 text-amber-400")} />
                                  </button>
                                  <Button asChild size="sm" variant="secondary" className="rounded-lg bg-muted border border-border hover:bg-muted/80 text-[10px] px-2 py-1 h-fit">
                                    <Link href={`/sessions/${node.sessionId}`}>
                                      Open File
                                    </Link>
                                  </Button>
                                </div>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                              {node.desc}
                            </p>

                            {node.meta && (
                              <div className="mt-2 text-[10px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded inline-block font-mono border border-border/50">
                                {node.meta}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* DPDP Access Audit Logs */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-success" />
                    DPDP Audit Trail Logs
                  </h3>
                  <span className="text-[9px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded-tags">
                    Compliance Lock
                  </span>
                </div>

                <div className="space-y-3 font-mono text-[10px] text-muted-foreground">
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span>• Doctor Aditi Sharma accessed patient record profile</span>
                    <span>{new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span>• Consent log verify sync - IDB sandboxed record synched</span>
                    <span>Yesterday, 10:48 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Audio segment buffer deleted - Clinical retention protocol</span>
                    <span>June 12, 11:35 AM</span>
                  </div>
                </div>
              </Card>

            </div>
          )}

          {/* TAB 3: DEMOGRAPHICS & EDIT (Wired directly to Database!) */}
          {activeTab === "edit" && (
            <div className="space-y-6">
              {/* Demographics Card */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Update Patient Demographics</h3>
                  <p className="text-xs text-muted-foreground mt-1">Changes made here are directly written back to your clinical database.</p>
                </div>

                <CardBody className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-name" className="text-xs text-muted-foreground">Full Patient Name</Label>
                    <Input
                      id="p-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-card border-border focus:border-primary text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="p-phone" className="text-xs text-muted-foreground">Contact Phone Number</Label>
                    <Input
                      id="p-phone"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-card border-border focus:border-primary text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="p-dob" className="text-xs text-muted-foreground">Date of Birth</Label>
                      <Input
                        id="p-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-gender" className="text-xs text-muted-foreground">Gender</Label>
                      <Select
                        id="p-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      >
                        <option value="">Not specified</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="unknown">Unknown</option>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={save}
                      loading={saving}
                      disabled={!dirty}
                      className="rounded-buttons bg-primary hover:bg-primary/90 text-primary-foreground border border-border"
                    >
                      <Save className="size-4" />
                      Save Demographic Changes
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Emergency Contact & Insurance Card */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Emergency Contact &amp; Insurance Details</h3>
                  <p className="text-xs text-muted-foreground mt-1">Provide contact &amp; insurance network details to display on the patient profile.</p>
                </div>
                <CardBody className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ec-name" className="text-xs text-muted-foreground">Emergency Contact Name</Label>
                      <Input
                        id="ec-name"
                        value={ecName}
                        onChange={(e) => setEcName(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ec-relation" className="text-xs text-muted-foreground">Relationship</Label>
                      <Input
                        id="ec-relation"
                        value={ecRelation}
                        onChange={(e) => setEcRelation(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ec-phone" className="text-xs text-muted-foreground">Relationship Phone</Label>
                      <Input
                        id="ec-phone"
                        value={ecPhone}
                        onChange={(e) => setEcPhone(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ins-provider" className="text-xs text-muted-foreground">Insurance Provider</Label>
                      <Input
                        id="ins-provider"
                        value={insProvider}
                        onChange={(e) => setInsProvider(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ins-policy" className="text-xs text-muted-foreground">Policy Number</Label>
                      <Input
                        id="ins-policy"
                        value={insPolicy}
                        onChange={(e) => setInsPolicy(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ins-status" className="text-xs text-muted-foreground">Status</Label>
                      <Select
                        id="ins-status"
                        value={insStatus}
                        onChange={(e) => setInsStatus(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      >
                        <option value="">Not selected</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={saveMedicalProfile}
                      className="rounded-buttons bg-primary hover:bg-primary/90 text-primary-foreground border border-border"
                    >
                      <Save className="size-4" />
                      Save Contact &amp; Insurance
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Record Vitals Entry Card */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Record Patient Vitals</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manually enter a vital metrics log to track telemetry trends.</p>
                </div>
                <CardBody className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="v-bp" className="text-xs text-muted-foreground">Blood Pressure (mmHg)</Label>
                      <Input
                        id="v-bp"
                        placeholder="e.g. 120/80"
                        value={newBp}
                        onChange={(e) => setNewBp(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v-hr" className="text-xs text-muted-foreground">Heart Rate (BPM)</Label>
                      <Input
                        id="v-hr"
                        type="number"
                        placeholder="e.g. 72"
                        value={newHr}
                        onChange={(e) => setNewHr(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v-temp" className="text-xs text-muted-foreground">Body Temp (°F)</Label>
                      <Input
                        id="v-temp"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 98.6"
                        value={newTemp}
                        onChange={(e) => setNewTemp(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v-spo2" className="text-xs text-muted-foreground">SpO2 Level (%)</Label>
                      <Input
                        id="v-spo2"
                        type="number"
                        placeholder="e.g. 98"
                        value={newSpo2}
                        onChange={(e) => setNewSpo2(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v-weight" className="text-xs text-muted-foreground">Weight (kg)</Label>
                      <Input
                        id="v-weight"
                        type="number"
                        placeholder="e.g. 70"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={addVitalsEntry}
                      className="rounded-buttons bg-primary hover:bg-primary/90 text-primary-foreground border border-border"
                    >
                      <Plus className="size-4" />
                      Add Vital Entry
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Record Billing Invoice Card */}
              <Card className="bg-card border border-border p-6 rounded-cards backdrop-blur-md">
                <div className="border-b border-border pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Record Billing Invoice</h3>
                  <p className="text-xs text-muted-foreground mt-1">Log a payment invoice to patient records.</p>
                </div>
                <CardBody className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="b-service" className="text-xs text-muted-foreground">Service Description</Label>
                      <Input
                        id="b-service"
                        placeholder="e.g. Standard consultation"
                        value={newService}
                        onChange={(e) => setNewService(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-amount" className="text-xs text-muted-foreground">Amount (INR/USD)</Label>
                      <Input
                        id="b-amount"
                        placeholder="e.g. ₹800"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-status" className="text-xs text-muted-foreground">Payment Status</Label>
                      <Select
                        id="b-status"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="bg-card border-border focus:border-primary text-foreground"
                      >
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="refunded">Refunded</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={addBillingEntry}
                      className="rounded-buttons bg-primary hover:bg-primary/90 text-primary-foreground border border-border"
                    >
                      <Plus className="size-4" />
                      Add Billing Invoice
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

        </div>

      </div>

    </div>
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
  return `${age}`;
}

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
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
