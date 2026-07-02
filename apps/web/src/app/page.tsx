import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  Check,
  ClipboardList,
  FileText,
  Globe,
  Languages,
  Mic,
  Pill,
  ShieldCheck,
  Sparkles,
  Star,
  WifiOff,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/landing/LandingNav";
import { Faq } from "@/components/landing/Faq";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <Hero />
      <TrustBar />
      <StatBand />
      <HowItWorks />
      <Features />
      <WhyUs />
      <FaqSection />
      <ContactBand />
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div className="animate-fade-in">
          <Badge tone="teal" className="mb-4">
            <Sparkles className="size-3" />
            Notes that write themselves
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Talk to your patient.{" "}
            <span className="text-primary">We&apos;ll write the note.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Record the consultation and get structured SOAP notes and
            prescriptions in seconds — tuned for Indian English, Hindi &amp;
            Hinglish, ready for your review and sign-off.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/login">
                <Mic className="size-4" />
                Get started free
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Consent-first · DPDP-ready · Works offline
          </p>
        </div>

        <HeroMock />
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="relative animate-fade-in">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 to-transparent blur-2xl" />
      <Card className="relative overflow-hidden shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
          <span className="size-3 rounded-full bg-destructive/60" />
          <span className="size-3 rounded-full bg-warning/60" />
          <span className="size-3 rounded-full bg-success/60" />
          <span className="ml-2 text-xs text-muted-foreground">
            gooqi · consultation
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {/* Recording panel */}
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
              Recording consultation
            </div>
            <div className="flex h-16 items-center gap-1">
              {[6, 12, 20, 14, 24, 10, 18, 28, 12, 8, 22, 16, 26, 10, 14].map(
                (h, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-primary/70"
                    style={{ height: `${h * 2}px` }}
                  />
                ),
              )}
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-primary">Doctor:</span> Kya
                takleef hai?
              </p>
              <p>
                <span className="font-medium text-primary">Patient:</span> Do
                din se bukhar aur khaansi.
              </p>
            </div>
          </div>

          {/* SOAP note panel */}
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-primary" />
              Generated SOAP note
            </div>
            <div className="space-y-2 text-xs">
              <MockField label="Chief complaint" value="Fever & cough × 2 days" />
              <MockField label="Assessment" value="Acute viral URI" />
              <div>
                <p className="font-medium text-muted-foreground">Plan / Rx</p>
                <div className="mt-1 flex items-center gap-2 rounded bg-muted px-2 py-1">
                  <Pill className="size-3 text-primary" />
                  Paracetamol 500mg · BD · 3 days
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">
                <Check className="size-3" /> Sign &amp; finalise
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function TrustBar() {
  const items = [
    "Consent-first",
    "DPDP-ready",
    "Crash-safe recording",
    "Hallucination-guarded",
    "Swappable ASR",
  ];
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm text-muted-foreground">
        {items.map((i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <BadgeCheck className="size-4 text-primary" />
            {i}
          </span>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function StatBand() {
  const stats = [
    { value: "3", label: "languages · English, Hindi, Hinglish" },
    { value: "30s", label: "crash-safe recording autosave" },
    { value: "100%", label: "consent-gated consultations" },
  ];
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Less time typing, more time with your patient
        </h2>
        <p className="mt-1 text-primary-foreground/80">
          Structured notes and prescriptions, generated from the conversation.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-primary-foreground/10 py-6"
            >
              <div className="text-4xl font-semibold tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-primary-foreground/80">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    {
      icon: Mic,
      title: "Record the consultation",
      body: "Capture the visit in the browser with crash-safe recording — a refresh or dropped connection never loses it.",
    },
    {
      icon: BrainCircuit,
      title: "AI transcribes & structures",
      body: "Speaker-labelled transcript in Indian English, Hindi & Hinglish, grounded to what was actually said.",
    },
    {
      icon: ClipboardList,
      title: "Review & sign off",
      body: "Get an editable SOAP note, prescriptions and a plain-language visit summary — sign to finalise.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
      <SectionHeading
        eyebrow="How it works"
        title="From conversation to clinical note in three steps"
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.title} className="relative">
            <CardBody className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="text-4xl font-semibold text-muted/60">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl space-y-16 px-4">
        <SectionHeading
          eyebrow="Most-loved features"
          title="Built for how Indian clinics actually work"
        />

        {/* Multilingual */}
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Card className="order-2 p-5 lg:order-1">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Languages className="size-4 text-primary" />
                <span className="font-medium">Understood natively</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["English", "हिन्दी", "Hinglish"].map((l) => (
                  <span
                    key={l}
                    className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                  >
                    {l}
                  </span>
                ))}
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                “Do din se bukhar hai, cough bhi ho rahi hai” →{" "}
                <span className="text-foreground">
                  Fever &amp; cough × 2 days
                </span>
              </p>
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <Badge tone="teal" className="mb-3">
              <Globe className="size-3" /> Multilingual
            </Badge>
            <h3 className="text-2xl font-semibold">Speak freely, we understand</h3>
            <p className="mt-2 text-muted-foreground">
              Real consultations mix languages, accents and interruptions in a
              noisy OPD. Gooqi is tuned for exactly that — and grounds every note
              to what was actually said.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function WhyUs() {
  const cards = [
    {
      icon: WifiOff,
      title: "Crash-safe by design",
      body: "Audio is saved on-device in chunks as you record. A refresh or dropped connection never loses a consultation.",
    },
    {
      icon: ShieldCheck,
      title: "Clinical-grade & compliant",
      body: "Hallucination-guarded generation with server-side validation, hard consent gating and an append-only audit log.",
    },
    {
      icon: Zap,
      title: "Fast & swappable",
      body: "Structured notes in seconds, on a speech engine you can swap per market for the right cost and accuracy.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <SectionHeading
        eyebrow="Why Gooqi"
        title="Purpose-built AI scribe, not a side project"
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardBody className="space-y-3 p-6">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="size-5" />
              </span>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
      <SectionHeading
        eyebrow="FAQ"
        title="Answers to common questions"
      />
      <div className="mt-12">
        <Faq />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function ContactBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <Card className="overflow-hidden bg-primary text-primary-foreground">
        <div className="flex flex-col items-center gap-4 p-10 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to get your evenings back?
          </h2>
          <p className="max-w-xl text-primary-foreground/80">
            Start free in minutes. Record your first consultation and see the
            note write itself.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/login">
              <Star className="size-4" />
              Get started free
            </Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function Footer() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </span>
          Gooqi Scribe
        </Link>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Gooqi Health. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}
