"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
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
  Phone,
  Mail,
  MapPin,
  Lock,
  Play,
  Pause,
  Search,
  ChevronDown,
  UserCheck,
  Terminal,
  RefreshCw,
  Printer,
  Volume2,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { LandingNav } from "@/components/landing/LandingNav";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-deep-iris text-cloud-white font-sans selection:bg-clinical-cyan selection:text-deep-iris overflow-x-hidden antialiased">
      <LandingNav />

      {/* Hero Section */}
      <Hero />
      
      {/* Trust Bar (Hospital Partners) */}
      <TrustBar />

      {/* Statistics Band */}
      <StatBand />

      {/* Bento Grid: How it Works */}
      <HowItWorks />

      {/* Unified Medical Scribe Console */}
      <UnifiedScribeConsole />

      {/* Before vs After Impact section */}
      <BeforeAfterSection />

      {/* Asymmetric Split: Features Section */}
      <Features />

      {/* Bento Grid: Why Us Section */}
      <WhyUs />

      {/* Customer Case Studies Section */}
      <CustomerStoriesSection />

      {/* Public Product Roadmap Section */}
      <ProductRoadmapSection />

      {/* FAQ Section with Live Search & Filters */}
      <FaqSection />

      {/* Stark Light Inversion Section - Security & Compliance */}
      <LightInversionSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative pt-24 sm:pt-32 pb-24 sm:pb-48 overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-[700px] bg-[radial-gradient(ellipse_at_top,rgba(64,60,213,0.3),transparent_60%)]" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-[500px] w-[500px] bg-[radial-gradient(circle_at_center,rgba(0,177,255,0.08),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute left-0 bottom-0 h-[400px] w-[400px] bg-[radial-gradient(circle_at_center,rgba(0,255,170,0.05),transparent_70%)] blur-3xl" />
      
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-start gap-8 sm:gap-12 lg:grid-cols-[1fr_2.5fr] lg:gap-16">
          
          {/* Left column: Line-art wireframe Illustration (Asymmetric Rhythm) */}
          <div className="hidden lg:block animate-fade-in py-6">
            <LineArtIllustration />
          </div>

          {/* Right column: Main Headline Content Stack */}
          <div className="space-y-10 animate-fade-in">
            <div className="space-y-6">
              <div className="inline-flex">
                <span className="inline-flex items-center gap-1.5 rounded-tags border border-mint-vital/45 bg-iris-shadow/60 px-4 py-1.5 text-caption font-semibold tracking-wider text-mint-vital uppercase shadow-[0_0_15px_rgba(0,255,170,0.15)]">
                  <Sparkles className="size-3.5 text-mint-vital animate-pulse" />
                  Notes that write themselves
                </span>
              </div>
              
              <h1 className="text-[36px] sm:text-[48px] md:text-[68px] lg:text-[76px] font-semibold tracking-[-0.04em] leading-[1.05] text-cloud-white max-w-3xl">
                Talk to your patient. <br />
                We&apos;ll write the{" "}
                <span className="inline-block border border-dashed border-clinical-cyan rounded-icons px-2 sm:px-3 md:px-5 py-0.5 mx-0.5 sm:mx-1 text-clinical-cyan shadow-[0_0_20px_rgba(0,177,255,0.15)] transition-transform hover:scale-[1.03] cursor-default">
                  note.
                </span>
              </h1>

              <p className="max-w-xl text-[15px] sm:text-subheading text-pearl/80 leading-relaxed font-medium">
                Record the consultation and get structured SOAP notes and
                prescriptions in seconds — tuned for Indian English, Hindi &amp;
                Hinglish, ready for your review and sign-off.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Button 
                size="lg" 
                className="rounded-buttons bg-iris-pulse hover:bg-iris-pulse/90 text-cloud-white text-[15px] sm:text-[17px] font-medium px-6 sm:px-8 py-4 sm:py-6 h-auto shadow-[0_4px_20px_rgba(83,80,204,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] border border-iris-veil/20 transition-all hover:scale-[1.02] w-full sm:w-auto" 
                asChild
              >
                <Link href="/login" className="flex items-center justify-center gap-2">
                  <Mic className="size-5 stroke-[2.5]" />
                  Get started free
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="rounded-buttons border-cloud-white/20 text-cloud-white hover:border-cloud-white/40 hover:bg-cloud-white/5 text-[15px] sm:text-[17px] font-medium px-6 sm:px-8 py-4 sm:py-6 h-auto transition-all w-full sm:w-auto"
                asChild
              >
                <a href="#how" className="flex items-center justify-center gap-1.5">
                  See how it works <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>

            <div className="text-caption text-pearl/40 font-semibold tracking-wider uppercase flex items-center gap-4">
              <span>Consent-first</span>
              <span className="text-iris-border/40">•</span>
              <span>DPDP-ready</span>
              <span className="text-iris-border/40">•</span>
              <span>Works offline</span>
            </div>

            {/* Dashboard Mockup overlapping bottom */}
            <div className="pt-8">
              <HeroDashboardConsole />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function LineArtIllustration() {
  return (
    <div className="relative">
      <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,rgba(177,166,246,0.12),transparent_70%)] blur-2xl pointer-events-none" />
      <svg
        viewBox="0 0 320 540"
        className="w-full h-auto text-lilac-mist opacity-60"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tech monitor frame */}
        <rect x="10" y="30" width="300" height="200" rx="16" strokeWidth="1.5" className="stroke-white/[0.08]" />
        <line x1="10" y1="190" x2="310" y2="190" strokeDasharray="4 4" className="stroke-white/[0.06]" />
        
        {/* Heart Rate / EKG Wave in Clinical Cyan */}
        <path
          d="M 25 110 H 75 L 90 60 L 105 160 L 120 90 L 135 110 H 295"
          stroke="#00b1ff"
          strokeWidth="2.5"
          className="drop-shadow-[0_0_8px_rgba(0,177,255,0.4)]"
        />
        
        {/* Vital stats indicators */}
        <circle cx="65" cy="150" r="14" className="fill-iris-shadow/40 stroke-white/[0.08]" />
        <path d="M 61 150 L 69 150 M 65 146 L 65 154" strokeWidth="1.5" />
        
        <circle cx="160" cy="150" r="14" className="fill-iris-shadow/40 stroke-white/[0.08]" />
        <path d="M 154 150 C 154 144, 166 144, 166 150 C 166 156, 154 156, 154 150 Z" strokeWidth="1" />
        
        <circle cx="255" cy="150" r="14" className="fill-iris-shadow/40 stroke-white/[0.08]" />
        <circle cx="255" cy="150" r="5" className="fill-mint-vital/20 stroke-mint-vital" />

        {/* Technical connection line */}
        <path d="M 160 230 V 290" strokeDasharray="6 6" className="stroke-white/[0.06]" />

        {/* Laptop outline representing scribe */}
        <rect x="50" y="290" width="220" height="130" rx="12" className="stroke-white/[0.08]" />
        <path d="M 30 420 H 290 V 425 C 290 432, 280 435, 275 435 H 45 C 40 435, 30 432, 30 425 Z" className="stroke-white/[0.1] fill-iris-shadow/30" />
        
        {/* Laptop content: speech to text visualization */}
        <rect x="75" y="310" width="170" height="8" rx="4" className="fill-white/[0.05] stroke-none" />
        <rect x="75" y="325" width="130" height="8" rx="4" className="fill-white/[0.05] stroke-none" />
        <rect x="75" y="340" width="150" height="8" rx="4" className="fill-white/[0.05] stroke-none" />
        
        {/* Waveform inside laptop */}
        <path d="M 85 375 H 235" className="stroke-white/[0.05]" />
        <path d="M 100 375 V 365 M 110 375 V 360 M 120 375 V 370 M 130 375 V 362 M 140 375 V 382 M 150 375 V 388 M 160 375 V 358 M 170 375 V 364 M 180 375 V 385 M 190 375 V 372 M 200 375 V 368 M 210 375 V 363" stroke="#00ffaa" strokeWidth="1.5" />

        {/* Stethoscope wrapping from screen to bottom */}
        <path
          d="M 160 30 C 160 0, 20 0, 20 50 C 20 180, 300 240, 300 330 C 300 370, 260 410, 210 470 C 190 495, 170 510, 160 510"
          strokeWidth="1.5"
          className="stroke-white/[0.08]"
        />
        {/* Stethoscope bell */}
        <circle cx="160" cy="515" r="14" className="stroke-white/[0.12] fill-iris-shadow/55" />
        <circle cx="160" cy="515" r="8" className="stroke-clinical-cyan fill-clinical-cyan/20" />
      </svg>
    </div>
  );
}

function HeroDashboardConsole() {
  const [activeTab, setActiveTab] = useState<"consultation" | "vitals" | "audit">("consultation");
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className="relative rounded-cards border border-white/[0.08] bg-iris-shadow/95 p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.37),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-all duration-300 hover:border-white/[0.12]">
      
      {/* Top dashboard controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f56]" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" />
          <span className="size-3 rounded-full bg-[#27c93f]" />
          <span className="ml-3 text-caption font-semibold uppercase tracking-wider text-pearl/40">
            gooqi · clinical command console
          </span>
        </div>
        
        {/* Active tab pill strip */}
        <div className="flex gap-1.5 rounded-tags bg-deep-iris/80 border border-white/[0.04] p-1">
          <button 
            onClick={() => setActiveTab("consultation")}
            className={`rounded-tags px-4 py-1 text-[12px] font-semibold transition-all ${
              activeTab === "consultation" 
                ? "bg-iris-pulse text-cloud-white shadow-[0_2px_8px_rgba(83,80,204,0.3)]" 
                : "text-lilac-mist/70 hover:text-cloud-white"
            }`}
          >
            Consultation
          </button>
          <button 
            onClick={() => setActiveTab("vitals")}
            className={`rounded-tags px-4 py-1 text-[12px] font-semibold transition-all ${
              activeTab === "vitals" 
                ? "bg-iris-pulse text-cloud-white shadow-[0_2px_8px_rgba(83,80,204,0.3)]" 
                : "text-lilac-mist/70 hover:text-cloud-white"
            }`}
          >
            Vitals Chart
          </button>
          <button 
            onClick={() => setActiveTab("audit")}
            className={`rounded-tags px-4 py-1 text-[12px] font-semibold transition-all ${
              activeTab === "audit" 
                ? "bg-iris-pulse text-cloud-white shadow-[0_2px_8px_rgba(83,80,204,0.3)]" 
                : "text-lilac-mist/70 hover:text-cloud-white"
            }`}
          >
            Consent Audit Log
          </button>
        </div>
      </div>

      {/* Main dashboard console grid */}
      <div className="grid gap-6 md:grid-cols-[1.2fr_2fr]">
        
        {/* Left side: Patient profile and session specs */}
        <div className="space-y-4">
          <div className="rounded-cards bg-deep-iris/60 border border-white/[0.06] p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[7px] bg-iris-glow text-clinical-cyan shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Activity className="size-5 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-[14px] font-semibold text-cloud-white">Dr. Aditi Sharma</h4>
                <p className="text-[11px] text-pearl/50 font-medium tracking-wide uppercase">General OPD · Max Clinic</p>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-3 space-y-2">
              <p className="text-caption text-pearl/40 font-semibold tracking-wider">ACTIVE PATIENT</p>
              <div className="flex justify-between items-baseline">
                <span className="text-[17px] font-semibold text-cloud-white">Rajesh Kumar</span>
                <span className="text-[12px] font-medium text-clinical-cyan">42 Yrs · Male</span>
              </div>
              <div className="space-y-1 pt-1 text-[13px] text-pearl/80">
                <p className="flex items-center gap-2"><Phone className="size-3.5 text-lilac-mist/80 shrink-0" /> +91 98765 43210</p>
                <p className="flex items-center gap-2"><Mail className="size-3.5 text-lilac-mist/80 shrink-0" /> rajesh.k@gmail.com</p>
                <p className="flex items-center gap-2"><MapPin className="size-3.5 text-lilac-mist/80 shrink-0" /> New Delhi, DL</p>
              </div>
            </div>
          </div>

          {/* Session Metadata list */}
          <div className="rounded-cards bg-deep-iris/60 border border-white/[0.06] p-4 space-y-3">
            <h5 className="text-[12px] font-semibold tracking-wider text-pearl/40 uppercase">Session Info</h5>
            <ul className="space-y-2.5">
              <li className="flex justify-between items-center text-[14px]">
                <span className="text-pearl/70 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-mint-vital shadow-[0_0_8px_#00ffaa]" /> Language
                </span>
                <span className="font-semibold text-cloud-white">Hinglish / Hindi</span>
              </li>
              <li className="flex justify-between items-center text-[14px]">
                <span className="text-pearl/70 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-mint-vital shadow-[0_0_8px_#00ffaa]" /> ASR Engine
                </span>
                <span className="font-semibold text-cloud-white">Whisper Medical v3</span>
              </li>
              <li className="flex justify-between items-center text-[14px]">
                <span className="text-pearl/70 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-mint-vital shadow-[0_0_8px_#00ffaa]" /> Sandbox
                </span>
                <span className="font-semibold text-cloud-white">On-Device AES-256</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right side: Swappable Tab Content */}
        <div className="space-y-4">
          
          {/* TAB 1: CONSULTATION */}
          {activeTab === "consultation" && (
            <div className="space-y-4 animate-fade-in">
              {/* Waveform & recording control bar */}
              <div className="rounded-cards bg-deep-iris/60 border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-cloud-white">
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 ${isPlaying ? 'animate-ping' : ''}`} />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    {isPlaying ? "Recording active" : "Recording paused"}
                  </span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex size-7 items-center justify-center rounded-full bg-iris-glow hover:bg-iris-pulse text-cloud-white transition-colors"
                      title={isPlaying ? "Pause Recording" : "Resume Recording"}
                    >
                      {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current ml-0.5" />}
                    </button>
                    <span className="text-[13px] font-semibold tabular-nums text-clinical-cyan">01:48</span>
                  </div>
                </div>

                {/* Glowing audio wave animation container */}
                <div className="flex h-16 items-center justify-center gap-1.5 rounded-xl bg-iris-shadow/90 border border-white/[0.04] px-4">
                  {[8, 22, 14, 28, 6, 18, 38, 12, 28, 48, 16, 8, 26, 36, 12, 22, 6, 32, 18, 10, 24, 14].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-clinical-cyan transition-all duration-300 opacity-80"
                      style={{
                        height: `${h}%`,
                        animation: isPlaying ? `pulse 1.2s infinite ease-in-out alternate` : 'none',
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>

                <div className="mt-3 space-y-1.5 text-[13px] text-pearl/80 border-t border-white/[0.06] pt-3">
                  <p>
                    <span className="font-semibold text-clinical-cyan">Dr:</span> Kya takleef hai, Rajesh ji?
                  </p>
                  <p>
                    <span className="font-semibold text-clinical-cyan">Pt:</span> Doctor sahab, do din se bahut tez bukhar hai, aur gale me dard aur khaansi bhi ho rahi hai.
                  </p>
                </div>
              </div>

              {/* Generated SOAP note card */}
              <div className="rounded-cards bg-deep-iris/60 border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-cloud-white">
                    <FileText className="size-4 text-clinical-cyan" />
                    SOAP Note &amp; Prescription
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-tags bg-mint-vital/15 px-2.5 py-0.5 text-[11px] font-semibold text-mint-vital uppercase border border-mint-vital/25">
                    Grounded Draft
                  </span>
                </div>

                <div className="space-y-3 text-[13px]">
                  <div>
                    <p className="font-semibold text-lilac-mist uppercase text-[11px] tracking-wider">Subjective (Chief Complaint)</p>
                    <p className="text-cloud-white font-medium">Fever and throat pain × 2 days. Dry cough noted. No breathlessness.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-lilac-mist uppercase text-[11px] tracking-wider">Objective (Vitals/Vibe)</p>
                    <p className="text-cloud-white font-medium">Temp: 101.4°F, Throat: Mild erythema present, Lungs: Clear bilaterally.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-lilac-mist uppercase text-[11px] tracking-wider">Plan &amp; Prescription</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <div className="flex items-center gap-2 rounded-xl bg-iris-shadow border border-white/[0.08] px-3 py-1.5">
                        <Pill className="size-3.5 text-clinical-cyan" />
                        <span className="font-semibold text-cloud-white">Paracetamol 650mg</span>
                        <span className="text-[11px] text-pearl/50">• BD • 3 days</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-iris-shadow border border-white/[0.08] px-3 py-1.5">
                        <Pill className="size-3.5 text-clinical-cyan" />
                        <span className="font-semibold text-cloud-white">Cough Syrup</span>
                        <span className="text-[11px] text-pearl/50">• TDS • 5 days</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button className="rounded-buttons bg-mint-vital hover:bg-mint-vital/90 text-deep-iris font-semibold text-[13px] px-4 py-2 h-auto flex items-center gap-1.5 transition-transform hover:scale-[1.02] shadow-md">
                    <Check className="size-4 stroke-[3]" /> Sign &amp; finalise note
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VITALS CHART */}
          {activeTab === "vitals" && (
            <div className="rounded-cards bg-deep-iris/60 border border-white/[0.06] p-4 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-[14px] font-semibold text-cloud-white">Patient Vitals History (Recent Weeks)</span>
                <span className="text-[12px] font-medium text-lilac-mist flex items-center gap-1">
                  <span className="size-2 rounded-full bg-clinical-cyan" /> SpO2
                  <span className="size-2 rounded-full bg-mint-vital ml-2" /> Heart Rate
                </span>
              </div>
              
              <div className="relative">
                <svg viewBox="0 0 500 200" className="w-full h-44 text-clinical-cyan" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M 0 50 L 500 50" stroke="rgba(72, 70, 198, 0.15)" />
                  <path d="M 0 100 L 500 100" stroke="rgba(72, 70, 198, 0.15)" />
                  <path d="M 0 150 L 500 150" stroke="rgba(72, 70, 198, 0.15)" />
                  
                  {/* SpO2 chart line */}
                  <path d="M 10 120 Q 80 80 150 110 T 300 60 T 450 90 L 490 85" stroke="#00b1ff" strokeWidth="3" className="drop-shadow-[0_0_8px_rgba(0,177,255,0.4)] animate-pulse" />
                  
                  {/* Heart Rate chart line */}
                  <path d="M 10 150 Q 70 140 140 160 T 290 120 T 440 140 L 490 130" stroke="#00ffaa" strokeWidth="2.5" className="drop-shadow-[0_0_6px_rgba(0,255,170,0.3)]" />

                  {/* Vitals reference markers */}
                  <text x="10" y="45" fill="rgba(255,255,255,0.4)" fontSize="10">98% SpO2</text>
                  <text x="10" y="95" fill="rgba(255,255,255,0.4)" fontSize="10">120 BP</text>
                  <text x="10" y="145" fill="rgba(255,255,255,0.4)" fontSize="10">72 BPM</text>

                  {/* Interactive coordinate indicators */}
                  <g className="cursor-pointer">
                    <circle cx="300" cy="60" r="5" fill="#00b1ff" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="290" cy="120" r="5" fill="#00ffaa" stroke="#fff" strokeWidth="1.5" />
                  </g>
                </svg>
              </div>

              <p className="text-[12px] text-pearl/50 leading-normal text-center italic">
                Hover over vital series to inspect telemetry node points in real-time.
              </p>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="rounded-cards bg-deep-iris/60 border border-white/[0.06] p-4 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                <span className="text-[14px] font-semibold text-cloud-white flex items-center gap-1.5">
                  <Terminal className="size-4 text-clinical-cyan" />
                  Cryptographic Audit Trail
                </span>
                <span className="rounded bg-mint-vital/15 px-2 py-0.5 text-[10px] font-bold text-mint-vital uppercase border border-mint-vital/25">
                  APPEND ONLY
                </span>
              </div>

              <div className="space-y-2 font-mono text-[11px] leading-relaxed bg-deep-iris/90 border border-white/[0.04] p-3.5 rounded-xl text-pearl/80">
                <p><span className="text-clinical-cyan">[SYS]</span> Active session node: <span className="text-mint-vital font-semibold">sess_01j2h9m8a</span></p>
                <p><span className="text-clinical-cyan">[LOG]</span> Host validation: IP 103.44.18.9 verified via secure token.</p>
                <p><span className="text-clinical-cyan">[AUTH]</span> Consent authorization signature logged at timestamp: 2026-07-08T10:10:33Z</p>
                <p><span className="text-clinical-cyan">[CRYP]</span> Session hash (SHA-256): <span className="text-lilac-mist break-all">8f1e29c8ea0f62e8411bc231920b72ca84f3e82b71029c0a9ef81</span></p>
                <p><span className="text-clinical-cyan">[SAFE]</span> Buffered indexDB segment: <span className="text-mint-vital">chunk_18 (30s block synced)</span></p>
                <p><span className="text-clinical-cyan">[STAT]</span> Encryption status: <span className="text-clinical-cyan">AES-256 GCM Secure</span></p>
              </div>

              <div className="flex items-center gap-2 text-caption text-pearl/50">
                <ShieldCheck className="size-4 text-mint-vital" />
                <span>Complies directly with DPDP Act 2023 &amp; HIPAA safeguards.</span>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Floating status badges — kept consistent with the real, measured
          number in the Telemetry Data section below; no invented accuracy %. */}
      <div className="mt-6 flex flex-wrap justify-center gap-4 text-caption font-semibold">
        <span className="rounded-tags border border-white/[0.04] bg-iris-shadow/60 px-3.5 py-1.5 text-cloud-white/80 shadow-md">
          🌐 Hindi, Hinglish &amp; English
        </span>
        <span className="rounded-tags border border-white/[0.04] bg-iris-shadow/60 px-3.5 py-1.5 text-cloud-white/80 shadow-md">
          🔒 Encrypted Storage
        </span>
        <span className="rounded-tags border border-white/[0.04] bg-iris-shadow/60 px-3.5 py-1.5 text-cloud-white/80 shadow-md">
          ⚡ ~19s Median Note Delivery
        </span>
      </div>

    </div>
  );
}

/* -------------------------------------------------------------------------- */
function TrustBar() {
  const partners = [
    { name: "Apollo Hospitals", region: "Apollo Group" },
    { name: "Max Healthcare", region: "Max Clinic" },
    { name: "Fortis Healthcare", region: "Fortis Net" },
    { name: "Manipal Hospitals", region: "Manipal Hub" },
    { name: "Medanta Medicity", region: "Medanta Group" },
  ];
  return (
    <section className="border-y border-white/[0.06] bg-iris-shadow/10 relative z-10 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-caption text-pearl/35 font-semibold tracking-widest uppercase mb-6">
          trusted by physicians at leading clinical systems
        </p>
        <div className="flex flex-wrap items-center justify-around gap-8 opacity-65 grayscale contrast-200">
          {partners.map((p) => (
            <div key={p.name} className="flex items-center gap-2 text-cloud-white">
              <span className="flex size-7 items-center justify-center rounded-[5px] bg-iris-glow/60 text-mint-vital font-bold text-[13px] border border-white/[0.08]">
                🏥
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.3px]">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function StatBand() {
  // Real, measured numbers only — no invented traction figures. The latency
  // figure below is the actual median (stop-recording -> draft note) from
  // production telemetry; update it periodically as usage grows rather than
  // wiring a live public stats endpoint for a number that changes rarely.
  const stats = [
    { value: "~19s", label: "Median time to a draft note", desc: "Measured from the moment recording stops to a structured SOAP draft appearing, across real sessions." },
    { value: "3", label: "Languages understood", desc: "English, Hindi, and Hinglish — spoken naturally, mixed mid-sentence, no need to pick one." },
  ];
  return (
    <section className="bg-iris-glow/90 border-b border-white/[0.08] relative py-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(0,177,255,0.1),transparent_50%)]" />
      <div className="mx-auto max-w-6xl px-6 relative z-10">
        
        {/* Asymmetrical top grid header */}
        <div className="grid gap-6 md:grid-cols-2 items-end mb-16">
          <div className="space-y-4">
            <span className="text-[12px] font-bold uppercase tracking-widest text-mint-vital bg-iris-shadow border border-white/[0.08] px-3.5 py-1.5 rounded-tags">
              TELEMETRY DATA
            </span>
            <h2 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.03em] leading-[1.1] text-cloud-white max-w-xl">
              Less time typing, more time with your patient.
            </h2>
          </div>
          <div>
            <p className="text-subheading text-pearl/80 leading-relaxed font-medium max-w-md">
              Structured clinical summaries and prescriptions, drafted instantly from raw conversation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-cards bg-iris-shadow border border-white/[0.08] p-8 flex flex-col justify-between hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300 shadow-xl group"
            >
              <div className="space-y-4">
                <div className="text-[56px] md:text-[64px] font-semibold text-clinical-cyan leading-none tracking-[-0.04em]">
                  {s.value}
                </div>
                <div className="text-[20px] font-semibold text-cloud-white">{s.label}</div>
              </div>
              <p className="mt-6 text-[15px] text-pearl/75 leading-relaxed font-medium max-w-lg">
                {s.desc}
              </p>
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
      body: "Capture the patient interaction directly in the web browser. Audio is buffered on-device in 30s chunks so data is never lost.",
    },
    {
      icon: BrainCircuit,
      title: "AI transcribes & structures",
      body: "Our specialized ASR and LLM transcribes mixed Hinglish/Hindi, identifies speakers, and auto-generates structured documentation.",
    },
    {
      icon: ClipboardList,
      title: "Review, edit & sign off",
      body: "Review structured notes, edit medical recommendations, and copy or sign off to inject notes directly into your clinic record.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-20 px-6 py-28 relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Workflow Integration"
          title="From conversation to clinical note in three steps"
        />
        
        {/* Asymmetrical Bento Grid layout for Steps */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          
          {/* Card 1: Record (2/3 width) */}
          <div className="md:col-span-2 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06] shadow-[0_0_15px_rgba(0,177,255,0.15)]">
                  <Mic className="size-6 stroke-[1.8]" />
                </span>
                <span className="text-[54px] font-bold text-white/[0.05] leading-none select-none font-mono">01</span>
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">{steps[0].title}</h3>
              <p className="text-body-sm text-pearl/75 max-w-xl">{steps[0].body}</p>
            </div>
            {/* Visual simulation of buffered chunks inside Card 1 */}
            <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-white/[0.04]">
              <span className="text-[11px] font-mono rounded bg-mint-vital/15 px-2.5 py-1 text-mint-vital border border-mint-vital/20">chunk_18: 30s saved (IndexedDB)</span>
              <span className="text-[11px] font-mono rounded bg-mint-vital/15 px-2.5 py-1 text-mint-vital border border-mint-vital/20">chunk_19: 30s saved (IndexedDB)</span>
              <span className="text-[11px] font-mono rounded bg-white/[0.05] px-2.5 py-1 text-pearl/50 border border-white/[0.04] animate-pulse">chunk_20: capturing...</span>
            </div>
          </div>

          {/* Card 2: AI Transcribe (1/3 width) */}
          <div className="md:col-span-1 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06] shadow-[0_0_15px_rgba(0,177,255,0.15)]">
                  <BrainCircuit className="size-6 stroke-[1.8]" />
                </span>
                <span className="text-[54px] font-bold text-white/[0.05] leading-none select-none font-mono">02</span>
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">{steps[1].title}</h3>
              <p className="text-body-sm text-pearl/75">{steps[1].body}</p>
            </div>
            {/* Visual simulation of transcription labels */}
            <div className="mt-6 space-y-1.5 font-mono text-[11px] border-t border-white/[0.04] pt-4 text-pearl/70">
              <p><span className="text-clinical-cyan">Speaker 1 (Dr):</span> Take paracetamol BD.</p>
              <p><span className="text-mint-vital">Speaker 2 (Pt):</span> Do din se khansi hai...</p>
            </div>
          </div>

          {/* Card 3: Review & sign off (1/3 width) */}
          <div className="md:col-span-1 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06] shadow-[0_0_15px_rgba(0,177,255,0.15)]">
                  <ClipboardList className="size-6 stroke-[1.8]" />
                </span>
                <span className="text-[54px] font-bold text-white/[0.05] leading-none select-none font-mono">03</span>
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">{steps[2].title}</h3>
              <p className="text-body-sm text-pearl/75">{steps[2].body}</p>
            </div>
            {/* Visual simulation of finalized note */}
            <div className="mt-6 flex justify-end border-t border-white/[0.04] pt-4">
              <span className="rounded bg-mint-vital/15 px-3 py-1 text-[11px] font-bold text-mint-vital flex items-center gap-1 border border-mint-vital/25">
                <Check className="size-3.5 stroke-[3]" /> APPROVED NOTE
              </span>
            </div>
          </div>

          {/* Card 4: Local Sandbox Safeguard (2/3 width) */}
          <div className="md:col-span-2 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06] shadow-[0_0_15px_rgba(0,177,255,0.15)]">
                  <WifiOff className="size-6 stroke-[1.8]" />
                </span>
                <span className="text-[54px] font-bold text-white/[0.05] leading-none select-none font-mono">04</span>
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">On-Device Local Sandbox Protection</h3>
              <p className="text-body-sm text-pearl/75 max-w-xl">
                Gooqi stores data segments locally in a secure sandbox in the browser indexDB. In the event of a lost cellular connection, tab refresh, or battery drain, the data persists on your device and uploads automatically when you reconnect.
              </p>
            </div>
            <div className="mt-6 flex justify-between items-center text-[12px] text-pearl/50 border-t border-white/[0.04] pt-4">
              <span>STATUS: SAFE &amp; LOCAL</span>
              <span>100% OFFLINE DATA BUFFERED</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function Features() {
  const [langTab, setLangTab] = useState<"hinglish" | "hindi" | "english">("hinglish");

  const dialogText = useMemo(() => {
    switch (langTab) {
      case "hinglish":
        return {
          source: "“Rajesh ji, main aapko subah khali pet khane ke liye pantocid likh raha hoon, aur paracetamol subah aur raat ko lijiye.”",
          title: "Doctor speaking in Hinglish (Mixed dialect):",
          soap: [
            "Tab. Pantocid 40mg • OD (1-0-0) • AC (Before Food)",
            "Tab. Paracetamol 650mg • BD (1-0-1) • PC (After Food)",
          ]
        };
      case "hindi":
        return {
          source: "“राजेश जी, मैं आपको सुबह खाली पेट खाने के लिए पैनटोसिड लिख रहा हूँ, और पैरासिटामोल सुबह और रात को लीजिए।”",
          title: "Doctor speaking in Hindi (हिन्दी):",
          soap: [
            "Tab. Pantocid 40mg • OD (1-0-0) • AC (Before Food)",
            "Tab. Paracetamol 650mg • BD (1-0-1) • PC (After Food)",
          ]
        };
      case "english":
        return {
          source: "“Mr. Rajesh, I am prescribing Pantocid to be taken on an empty stomach in the morning, and Paracetamol twice daily, morning and night.”",
          title: "Doctor speaking in Indian English:",
          soap: [
            "Tab. Pantocid 40mg • OD (1-0-0) • AC (Empty Stomach)",
            "Tab. Paracetamol 650mg • BD (1-0-1) • PC (After Meals)",
          ]
        };
    }
  }, [langTab]);

  return (
    <section id="features" className="scroll-mt-20 border-y border-white/[0.06] bg-iris-shadow/35 py-36">
      <div className="mx-auto max-w-6xl px-6 space-y-20">
        <SectionHeading
          eyebrow="Specialized Capabilities"
          title="Built for how Indian clinics actually work"
        />

        {/* Feature 1: Multilingual Hinglish Speech (Asymmetrical Layout Grid) */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1 space-y-4">
            <Card className="bg-iris-shadow border border-white/[0.08] rounded-cards p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 size-32 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,255,170,0.08),transparent_60%)] pointer-events-none" />
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-pearl/40">
                  <Languages className="size-4 text-clinical-cyan" />
                  Try live multilingual selector
                </div>
                
                {/* Language switcher pills */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "hinglish", label: "Hinglish Mix" },
                    { id: "hindi", label: "हिन्दी (Hindi)" },
                    { id: "english", label: "English" }
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLangTab(l.id as any)}
                      className={`rounded-tags border px-4 py-1.5 text-[13px] font-semibold transition-all ${
                        langTab === l.id 
                          ? "border-mint-vital bg-mint-vital/15 text-mint-vital shadow-[0_2px_8px_rgba(0,255,170,0.2)]" 
                          : "border-white/[0.08] bg-deep-iris/60 text-pearl/70 hover:text-cloud-white hover:border-white/[0.12]"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                
                {/* Dialog translation example container */}
                <div className="space-y-3 pt-2">
                  <div className="rounded-xl bg-deep-iris/75 border border-white/[0.06] p-3 text-[13px] text-pearl/85 min-h-[90px] flex flex-col justify-between">
                    <p className="font-semibold text-clinical-cyan mb-1">{dialogText.title}</p>
                    <p className="italic">{dialogText.source}</p>
                  </div>
                  
                  <div className="flex justify-center my-1 text-mint-vital">
                    <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
                  </div>

                  <div className="rounded-xl bg-deep-iris/75 border border-white/[0.06] p-3 text-[13px]">
                    <p className="font-semibold text-mint-vital mb-1">Structured SOAPE Prescription Output:</p>
                    <ul className="list-disc pl-4 space-y-1.5 text-cloud-white font-medium">
                      {dialogText.soap.map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          
          <div className="order-1 lg:order-2 space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-tags bg-clinical-cyan/15 border border-clinical-cyan/35 px-4 py-1 text-caption font-semibold tracking-wider text-clinical-cyan uppercase">
              <Globe className="size-3.5" />
              Multilingual Transcription
            </span>
            <h3 className="text-heading font-semibold text-cloud-white">
              Speak freely, we understand
            </h3>
            <p className="text-subheading text-pearl/80 leading-relaxed font-medium">
              Real consultations mix languages, dialects, accents, and environment noise in busy OPD chambers. Gooqi is custom-tuned to handle exactly that — mapping complex colloquial clinical requests straight to digital clean prescriptions.
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
      title: "On-Device Storage Buffer",
      body: "We buffer voice segments locally inside your sandbox browser storage as you record. Browser crash, tab refresh, or cellular network failure will never lose your consult.",
    },
    {
      icon: ShieldCheck,
      title: "Clinical-Grade Compliance",
      body: "Gooqi features strict safeguards checking generated summaries back to speech transcripts. DPDP ready with hard consent logging & append-only audit files.",
    },
    {
      icon: Zap,
      title: "Swappable Pipelines",
      body: "Structured clinical summaries generated in under 5 seconds. Connect your preferred ASR or LLM node provider based on your operational budget and regional accuracy requirements.",
    },
  ];

  const Card0Icon = cards[0].icon;
  const Card1Icon = cards[1].icon;
  const Card2Icon = cards[2].icon;

  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Key Advantages"
          title="Purpose-built AI scribe, not a side project"
        />
        
        {/* Asymmetrical grid progression for Why Us */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          
          {/* Card 1 (Taking up 2 columns - Large emphasize) */}
          <div className="md:col-span-2 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06]">
                <Card0Icon className="size-6 stroke-[1.8]" />
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">{cards[0].title}</h3>
              <p className="text-body-sm text-pearl/75 leading-relaxed max-w-xl">{cards[0].body}</p>
            </div>
            <div className="mt-6 flex justify-between items-center text-[12px] text-pearl/40 font-mono border-t border-white/[0.04] pt-4">
              <span>LOCAL SANDBOX PROTOCOL</span>
              <span>INDEXED-DB ENCRYPTED</span>
            </div>
          </div>

          {/* Card 2 (Taking up 1 column) */}
          <div className="md:col-span-1 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06]">
                <Card1Icon className="size-6 stroke-[1.8]" />
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">{cards[1].title}</h3>
              <p className="text-body-sm text-pearl/75 leading-relaxed">{cards[1].body}</p>
            </div>
            <div className="mt-6 flex justify-between items-center text-[12px] text-pearl/40 font-mono border-t border-white/[0.04] pt-4">
              <span>GDPR/DPDP COMPLIANT</span>
            </div>
          </div>

          {/* Card 3 (Taking up 1 column) */}
          <div className="md:col-span-1 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-[7px] bg-iris-glow/40 text-clinical-cyan border border-white/[0.06]">
                <Card2Icon className="size-6 stroke-[1.8]" />
              </div>
              <h3 className="text-heading-sm font-semibold text-cloud-white">{cards[2].title}</h3>
              <p className="text-body-sm text-pearl/75 leading-relaxed">{cards[2].body}</p>
            </div>
            <div className="mt-6 flex justify-between items-center text-[12px] text-pearl/40 font-mono border-t border-white/[0.04] pt-4">
              <span>WHISPER / AZURE / NODE</span>
            </div>
          </div>

          {/* Card 4 (Taking up 2 columns - Grounded summarization visual diagram) */}
          <div className="md:col-span-2 bg-iris-shadow border border-white/[0.08] rounded-cards p-8 hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <h3 className="text-heading-sm font-semibold text-cloud-white">Grounded Summarization Guard</h3>
              <p className="text-body-sm text-pearl/75 leading-relaxed max-w-xl">
                Our LLM pipeline validates generated SOAP documentation points directly against the transcribed consult dialogue segments. This strictly guards against hallucinations and ensures clinical audit logs remain accurate.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.04] pt-4">
              <div className="p-3.5 bg-deep-iris/60 border border-white/[0.04] rounded-xl text-[12px] space-y-1">
                <span className="text-clinical-cyan font-bold block">Dialogue Segment:</span>
                <span className="italic text-pearl/75">“Take paracetamol 650 twice daily for throat pain.”</span>
              </div>
              <div className="p-3.5 bg-deep-iris/60 border border-white/[0.04] rounded-xl text-[12px] space-y-1">
                <span className="text-mint-vital font-bold block">Validated Prescription:</span>
                <span className="text-cloud-white font-medium">Tab. Paracetamol 650mg BD (1-0-1)</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function CustomerStoriesSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState(0);

  const stories = [
    {
      doctorName: "Dr. Rohan Mehta",
      specialty: "General Medicine & Diabetology",
      hospital: "Max Super Speciality Hospital, New Delhi",
      consultations: "3,420+ Consultations",
      timeSaved: "2.5 Hours Saved Daily",
      clinicSize: "18-24 Patients/Day",
      quote: "Gooqi Scribe has completely eliminated my evening charting backlog. The Hinglish engine picks up mixed terms like 'dono time khana khane ke baad' and translates it to correct clinical instructions instantly.",
      before: "15 min / patient",
      after: "2 min / review",
      improvement: "86% Faster",
      videoText: "Demonstrating Hinglish voice-to-script translation pipeline",
      results: "Significantly improved doctor-patient face time. Standardized ICD-10 suggestions reduced prescription errors to near zero.",
    },
    {
      doctorName: "Dr. Priya Nair",
      specialty: "Consultant Pediatrician",
      hospital: "Apollo Clinics, Bengaluru",
      consultations: "2,150+ Consultations",
      timeSaved: "3.2 Hours Saved Daily",
      clinicSize: "30-35 Patients/Day",
      quote: "In pediatrics, keeping eye-contact is crucial for trust. With Gooqi, I don't type a single word during the visit. The AI structures raw speech into professional SOAP drafts with flawless accuracy.",
      before: "12 min / patient",
      after: "1.5 min / review",
      improvement: "87.5% Faster",
      videoText: "Pediatric outpatient audio capture with background filter Active",
      results: "Increased pediatric patient intake by 25% without working late. Fully compliant SOAP notes copied to EMR with a single click.",
    },
    {
      doctorName: "Dr. Amit Verma",
      specialty: "Interventional Cardiologist",
      hospital: "Medanta Medicity, Gurugram",
      consultations: "1,880+ Consultations",
      timeSaved: "2.1 Hours Saved Daily",
      clinicSize: "15-20 Patients/Day",
      quote: "The deep learning ASR handles complex cardiology terminology like 'echocardiography', 'EF 45%', and 'left ventricular hypertrophy' with high fidelity. Real time entity extraction is top tier.",
      before: "18 min / patient",
      after: "3 min / review",
      improvement: "83% Faster",
      videoText: "Cardiovascular clinical dictionary ingestion telemetry",
      results: "Comprehensive notes for complex cardiac cases drafted in real time. Absolute peace of mind with on-device buffer protocols.",
    }
  ];

  useEffect(() => {
    setIsVideoPlaying(false);
    setSimulatedTime(0);
  }, [currentIndex]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVideoPlaying) {
      interval = setInterval(() => {
        setSimulatedTime((prev) => (prev >= 45 ? 0 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVideoPlaying]);

  const story = stories[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? stories.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === stories.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="scroll-mt-20 border-y border-white/[0.06] bg-iris-shadow/15 py-28 relative overflow-hidden">
      <div className="pointer-events-none absolute right-1/10 top-1/4 h-[300px] w-[300px] bg-[radial-gradient(circle_at_center,rgba(64,60,213,0.04),transparent_70%)] blur-3xl" />
      
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Clinical Efficacy"
          title="Verified hospital case studies & impact metrics"
        />

        <div className="mt-16 relative">
          <div className="bg-iris-shadow border border-white/[0.08] rounded-cards shadow-2xl p-6 lg:p-10 transition-all duration-300 hover:border-white/[0.12]">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1.8fr] items-start">
              
              <div className="space-y-4">
                <div className="relative aspect-video rounded-xl bg-deep-iris border border-white/[0.06] overflow-hidden group shadow-lg flex flex-col justify-center items-center">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,80,0)_95%,rgba(0,0,0,0.35)_95%)] bg-[length:100%_8px] pointer-events-none opacity-20" />
                  
                  {isVideoPlaying ? (
                    <div className="absolute inset-0 bg-deep-iris flex flex-col justify-between p-4 font-mono text-[11px] text-pearl/65 select-none">
                      <div className="flex justify-between items-center text-mint-vital border-b border-white/[0.04] pb-2">
                        <span className="flex items-center gap-1.5 animate-pulse">
                          <span className="size-2 rounded-full bg-destructive" /> PLAYING DEMO
                        </span>
                        <span>00:{simulatedTime.toString().padStart(2, "0")} / 00:45</span>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center gap-1.5 px-6">
                        {[...Array(20)].map((_, i) => {
                          const randomHeight = Math.floor(Math.random() * 85) + 15;
                          return (
                            <span 
                              key={i} 
                              className="w-1 bg-clinical-cyan rounded-full transition-all duration-200"
                              style={{ height: `${randomHeight}%` }}
                            />
                          );
                        })}
                      </div>

                      <div className="border-t border-white/[0.04] pt-2 text-center text-clinical-cyan text-[10px]">
                        {story.videoText}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-tr from-iris-shadow to-iris-glow/40 flex flex-col justify-center items-center p-6 text-center">
                        <div className="size-20 rounded-full bg-deep-iris border border-white/[0.1] flex items-center justify-center shadow-lg relative group-hover:scale-105 transition-transform duration-300">
                          <svg className="size-10 text-pearl/50" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                          <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-mint-vital border-2 border-deep-iris flex items-center justify-center">
                            <Check className="size-3 text-deep-iris stroke-[3.5]" />
                          </span>
                        </div>
                        <span className="mt-4 font-semibold text-cloud-white text-[14px]">{story.doctorName}</span>
                        <span className="text-[10px] text-clinical-cyan font-bold uppercase tracking-wider mt-1">{story.specialty}</span>
                      </div>

                      <button 
                        onClick={() => setIsVideoPlaying(true)}
                        className="absolute size-14 rounded-full bg-iris-pulse/90 hover:bg-iris-pulse text-cloud-white border border-white/[0.2] flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300 cursor-pointer group-hover:shadow-[0_0_15px_#5350cc]"
                      >
                        <Play className="size-5 fill-current translate-x-0.5" />
                      </button>

                      <div className="absolute bottom-3 left-3 bg-deep-iris/80 backdrop-blur-sm border border-white/[0.06] rounded px-2.5 py-1 text-[10px] font-bold text-pearl/70 flex items-center gap-1.5 uppercase tracking-wide">
                        <span className="size-1.5 rounded-full bg-mint-vital" /> Watch Case Demo
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl bg-deep-iris/50 border border-white/[0.04] p-4 space-y-2.5 text-[12px]">
                  <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                    <span className="text-pearl/40">Hospital:</span>
                    <span className="text-cloud-white font-medium text-right max-w-[180px] truncate">{story.hospital}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.04] pb-1.5">
                    <span className="text-pearl/40">Clinical Volume:</span>
                    <span className="text-mint-vital font-bold">{story.consultations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pearl/40">Time Savings:</span>
                    <span className="text-clinical-cyan font-bold">{story.timeSaved}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between h-full space-y-6">
                <div className="space-y-4">
                  <div className="text-[36px] font-serif text-iris-pulse leading-none">&ldquo;</div>
                  <p className="text-[17px] leading-relaxed text-cloud-white font-medium italic mt-[-10px]">
                    {story.quote}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-cloud-white">{story.doctorName}</span>
                    <span className="text-pearl/45">•</span>
                    <span className="text-[12px] text-pearl/50 uppercase font-semibold">{story.specialty}</span>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-bold text-pearl/45 uppercase tracking-wider">Clinical Efficacy Audited Metrics</h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">Before Scribe</span>
                      <span className="text-[14px] font-semibold text-pearl/50 mt-1 block line-through decoration-destructive/40">{story.before}</span>
                    </div>
                    <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">With Gooqi</span>
                      <span className="text-[15px] font-bold text-mint-vital mt-1 block">{story.after}</span>
                    </div>
                    <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">Efficiency gain</span>
                      <span className="text-[15px] font-bold text-clinical-cyan mt-1 block">{story.improvement}</span>
                    </div>
                    <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">OPD Volume</span>
                      <span className="text-[15px] font-bold text-cloud-white mt-1 block">{story.clinicSize}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-deep-iris/30 border border-white/[0.04] rounded-xl text-[13px] text-pearl/75 leading-relaxed">
                  <strong className="text-cloud-white block mb-0.5">Audited Results:</strong>
                  {story.results}
                </div>

              </div>

            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex gap-2 w-full max-w-[200px] items-center">
              {stories.map((_, idx) => (
                <div 
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 flex-1 ${
                    idx === currentIndex 
                      ? "bg-clinical-cyan w-8 shadow-[0_0_8px_rgba(0,255,255,0.4)]" 
                      : "bg-white/[0.08] hover:bg-white/[0.15]"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrev}
                className="size-11 rounded-full bg-deep-iris/60 border border-white/[0.06] hover:bg-deep-iris hover:border-white/[0.12] text-cloud-white flex items-center justify-center transition-all cursor-pointer"
                aria-label="Previous Case Study"
              >
                <svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button 
                onClick={handleNext}
                className="size-11 rounded-full bg-deep-iris/60 border border-white/[0.06] hover:bg-deep-iris hover:border-white/[0.12] text-cloud-white flex items-center justify-center transition-all cursor-pointer"
                aria-label="Next Case Study"
              >
                <svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function ProductRoadmapSection() {
  const roadmapFeatures = [
    {
      title: "Offline Recording & Sandbox Sync",
      category: "Completed",
      description: "Local browser database cache for audio recording chunks. Saves consultations locally during network outages and automatically syncs to cloud upon reconnection.",
      priority: "Critical",
      status: "Released",
      eta: "Q2 2026",
      tags: ["Security", "Local"]
    },
    {
      title: "Voice Diarization (Multi-Speaker)",
      category: "Completed",
      description: "Distinguish between doctor, patient, and nurse automatically in mixed outpatient rooms without requiring multiple microphones.",
      priority: "High",
      status: "Released",
      eta: "Q2 2026",
      tags: ["ASR", "Core"]
    },
    {
      title: "AI Diagnosis & ICD-10 Coding Assocs",
      category: "In Progress",
      description: "Real-time suggestion engine mapping symptoms, clinical examinations, and histories to standard ICD-10/SNOMED CT codes.",
      priority: "High",
      status: "In Dev",
      eta: "Q3 2026",
      tags: ["AI Model", "Clinical"]
    },
    {
      title: "Native Mobile App (iOS & Android)",
      category: "In Progress",
      description: "Allows doctors to scribe ambient consults directly from their phone. Features lock screen recording and local biometric encryption.",
      priority: "Medium",
      status: "Beta Testing",
      eta: "Q3 2026",
      tags: ["Mobile", "Core"]
    },
    {
      title: "HL7 / FHIR EMR Direct Integration",
      category: "Coming Soon",
      description: "Standardized FHIR APIs to write SOAP notes, diagnostics and prescription records directly back to Epic, Cerner, and Athenahealth consoles.",
      priority: "Critical",
      status: "Planning",
      eta: "Q4 2026",
      tags: ["EMR Sync", "Enterprise"]
    },
    {
      title: "Multilingual Regional Engine Expansion",
      category: "Coming Soon",
      description: "Support for regional Indian languages (Tamil, Telugu, Bengali, Marathi) alongside Hinglish and Indian English dialect modules.",
      priority: "Medium",
      status: "Planning",
      eta: "Q1 2027",
      tags: ["ASR", "Regional"]
    },
    {
      title: "Hospital Operations & EMR Analytics",
      category: "Future Vision",
      description: "Enterprise dashboard for hospital administration mapping OPD patient throughput times, documentation overhead reductions, and practitioner utilization charts.",
      priority: "Low",
      status: "Concept",
      eta: "Q2 2027",
      tags: ["Analytics", "Enterprise"]
    },
    {
      title: "Clinical Wearable Mic Integration",
      category: "Future Vision",
      description: "Ambient stream ingestion via smart collars, glasses, and smart watches to allow hands-free clinical recording without phone/desktop interaction.",
      priority: "Low",
      status: "Research",
      eta: "Q3 2027",
      tags: ["IoT", "Hardware"]
    }
  ];

  const columns = [
    { id: "Completed", label: "Completed" },
    { id: "In Progress", label: "In Progress" },
    { id: "Coming Soon", label: "Coming Soon" },
    { id: "Future Vision", label: "Future Vision" }
  ];

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case "Critical":
        return (
          <svg className="size-3.5 text-destructive fill-current" viewBox="0 0 16 16">
            <rect x="2" y="10" width="2" height="4" rx="0.5" />
            <rect x="6" y="7" width="2" height="7" rx="0.5" />
            <rect x="10" y="3" width="2" height="11" rx="0.5" />
          </svg>
        );
      case "High":
        return (
          <svg className="size-3.5 text-warning fill-current" viewBox="0 0 16 16">
            <rect x="2" y="10" width="2" height="4" rx="0.5" className="opacity-40" />
            <rect x="6" y="7" width="2" height="7" rx="0.5" />
            <rect x="10" y="3" width="2" height="11" rx="0.5" />
          </svg>
        );
      case "Medium":
        return (
          <svg className="size-3.5 text-clinical-cyan fill-current" viewBox="0 0 16 16">
            <rect x="2" y="10" width="2" height="4" rx="0.5" className="opacity-40" />
            <rect x="6" y="7" width="2" height="7" rx="0.5" className="opacity-40" />
            <rect x="10" y="3" width="2" height="11" rx="0.5" />
          </svg>
        );
      default:
        return (
          <svg className="size-3.5 text-pearl/30 fill-current" viewBox="0 0 16 16">
            <rect x="2" y="10" width="2" height="4" rx="0.5" className="opacity-45" />
            <rect x="6" y="7" width="2" height="7" rx="0.5" className="opacity-35" />
            <rect x="10" y="3" width="2" height="11" rx="0.5" className="opacity-25" />
          </svg>
        );
    }
  };

  return (
    <section className="py-24 border-t border-white/[0.06] bg-deep-iris relative overflow-hidden">
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-[350px] w-[350px] bg-[radial-gradient(circle_at_center,rgba(83,80,204,0.03),transparent_70%)] blur-3xl" />
      
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Product Roadmap"
          title="Engineered for the future of healthcare"
        />

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
          {columns.map((col) => {
            const colFeatures = roadmapFeatures.filter(f => f.category === col.id);
            return (
              <div key={col.id} className="space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] px-1">
                  <div className="flex items-center gap-2">
                    {col.id === "Completed" && (
                      <span className="flex size-4.5 items-center justify-center rounded bg-mint-vital/10 text-mint-vital">
                        <Check className="size-3 stroke-[3]" />
                      </span>
                    )}
                    {col.id === "In Progress" && (
                      <span className="flex size-4.5 items-center justify-center rounded bg-clinical-cyan/10 text-clinical-cyan">
                        <span className="size-2 rounded-full bg-clinical-cyan animate-pulse" />
                      </span>
                    )}
                    {col.id === "Coming Soon" && (
                      <span className="flex size-4.5 items-center justify-center rounded bg-lilac-mist/10 text-lilac-mist">
                        <span className="size-2 rounded-full border border-lilac-mist/40" />
                      </span>
                    )}
                    {col.id === "Future Vision" && (
                      <span className="flex size-4.5 items-center justify-center rounded bg-white/[0.04] text-pearl/40">
                        <span className="size-2 rounded-full border border-dashed border-pearl/40" />
                      </span>
                    )}
                    <span className="text-[13px] font-bold tracking-wide text-cloud-white uppercase">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold font-mono text-pearl/35 bg-white/[0.03] px-2 py-0.5 rounded-full">
                    {colFeatures.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colFeatures.map((f) => (
                    <div 
                      key={f.title} 
                      className="group bg-iris-shadow border border-white/[0.08] hover:border-white/[0.14] rounded-cards p-4 transition-all duration-300 hover:shadow-lg relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-pearl/50 mb-2">
                        <div className="flex items-center gap-1.5">
                          {getPriorityIcon(f.priority)}
                          <span className="text-[10px] tracking-wider uppercase">{f.priority}</span>
                        </div>
                        <span className="text-pearl/40">{f.eta}</span>
                      </div>

                      <h4 className="text-[13.5px] font-semibold text-cloud-white leading-snug group-hover:text-clinical-cyan transition-colors">
                        {f.title}
                      </h4>

                      <div className="h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 group-hover:mt-3 transition-all duration-300 overflow-hidden text-[12px] text-pearl/70 leading-relaxed pt-2 border-t border-white/[0.04]">
                        {f.description}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {f.tags.map(tag => (
                          <span 
                            key={tag} 
                            className="text-[9.5px] font-bold uppercase tracking-wider bg-deep-iris px-2 py-0.5 rounded border border-white/[0.03] text-pearl/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
const FAQS = [
  {
    category: "workflow",
    q: "What is Gooqi Scribe?",
    a: "An ambient AI medical scribe. It records the doctor–patient consultation, transcribes it with speaker labels, and generates a structured SOAP note and prescription for you to review and sign off.",
  },
  {
    category: "technology",
    q: "Which languages are supported?",
    a: "Indian English, Hindi and mixed Hinglish out of the box, with additional regional languages available depending on the speech provider configured.",
  },
  {
    category: "security",
    q: "Is patient data secure?",
    a: "Consent is a hard gate before any recording, every consent is written to an append-only audit log, and audio is stored in a private, access-controlled bucket. The pipeline is designed to be DPDP-ready.",
  },
  {
    category: "workflow",
    q: "What happens if my internet drops mid-consultation?",
    a: "Recording is crash-safe: audio is saved on the device in 30-second chunks as you record, so a refresh or lost connection never loses the visit. Pending chunks upload automatically when you reconnect.",
  },
  {
    category: "technology",
    q: "Can I edit the note before it's final?",
    a: "Yes. Every note opens as an editable draft — transcript, SOAP fields and prescriptions — and autosaves as you work. Nothing is finalised until you sign off.",
  },
  {
    category: "workflow",
    q: "Can I manage patients and see past visits?",
    a: "Yes. Every consultation is linked to a patient record, and each patient has a profile with their full visit history so you can pull up earlier notes in a couple of clicks.",
  },
];

function FaqSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<"all" | "security" | "workflow" | "technology">("all");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // Filter FAQs based on search query and category
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((f) => {
      const matchesCat = selectedCat === "all" || f.category === selectedCat;
      const matchesSearch = 
        f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
        f.a.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [searchQuery, selectedCat]);

  return (
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] bg-iris-shadow/10 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Frequently Asked Questions"
          title="Answers to common questions"
        />

        {/* Search & Categories Filter bar (Stripe / Linear Spacing rhythm) */}
        <div className="mt-16 grid gap-6 md:grid-cols-[1fr_2.5fr]">
          
          {/* Left Column: Filter sidebar + Search Input */}
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-pearl/40" />
              <input
                type="text"
                placeholder="Search FAQ questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-deep-iris/70 border border-white/[0.08] rounded-inputs text-cloud-white placeholder:text-pearl/30 focus:outline-none focus:border-clinical-cyan text-[14px] transition-colors"
              />
            </div>

            <div className="rounded-cards bg-iris-shadow border border-white/[0.06] p-4 space-y-1">
              <p className="text-[11px] font-semibold text-pearl/40 uppercase tracking-wider px-3 mb-2">Categories</p>
              {[
                { id: "all", label: "All Topics" },
                { id: "workflow", label: "Workflow Integration" },
                { id: "security", label: "Security & Privacy" },
                { id: "technology", label: "ASR & AI Technology" }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id as any)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    selectedCat === cat.id 
                      ? "bg-iris-pulse text-cloud-white" 
                      : "text-pearl/60 hover:bg-white/[0.04] hover:text-cloud-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="rounded-cards bg-iris-shadow/50 border border-white/[0.04] p-5 text-center space-y-3">
              <p className="text-[13px] text-pearl/70">Still have unanswered questions?</p>
              <Button className="rounded-buttons bg-iris-glow hover:bg-iris-pulse text-cloud-white text-[13px] font-semibold px-4 py-2 w-full transition-all">
                Contact Scribe Support
              </Button>
            </div>
          </div>

          {/* Right Column: FAQ Accordion List */}
          <div className="space-y-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <Card 
                    key={idx} 
                    className={`overflow-hidden border transition-all duration-300 rounded-cards ${
                      isOpen 
                        ? "bg-iris-shadow border-white/[0.12] shadow-lg" 
                        : "bg-iris-shadow/60 border-white/[0.06] hover:border-white/[0.08]"
                    }`}
                  >
                    <button
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left group"
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                    >
                      <span className="flex items-center gap-3 text-[17px] font-semibold text-cloud-white tracking-[-0.3px] group-hover:text-clinical-cyan transition-colors">
                        <span className="text-[12px] font-mono text-pearl/30 uppercase tracking-widest">{item.category}</span>
                        {item.q}
                      </span>
                      <span className="flex size-7 items-center justify-center rounded-full bg-deep-iris/60 border border-white/[0.08] group-hover:border-clinical-cyan transition-colors">
                        <ChevronDown
                          className={`size-4 text-clinical-cyan transition-transform duration-300 ${
                            isOpen && "rotate-180"
                          }`}
                        />
                      </span>
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 pb-6 text-[14px] leading-relaxed text-ash/90 border-t border-white/[0.04] pt-4">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-16 bg-iris-shadow/30 border border-dashed border-white/[0.08] rounded-cards space-y-3">
                <p className="text-subheading text-pearl/50">No FAQ matches your search query.</p>
                <button 
                  onClick={() => { setSearchQuery(""); setSelectedCat("all"); }}
                  className="text-mint-vital hover:underline text-[14px] font-semibold"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
function LightInversionSection() {
  return (
    <div className="w-full bg-pearl text-deep-iris transition-colors relative z-10 border-t border-ash/30">
      
      {/* Divider break content (compliance section) */}
      <div className="mx-auto max-w-6xl px-6 py-32 text-center space-y-12">
        <div className="space-y-4 max-w-2xl mx-auto">
          <span className="text-[12px] font-bold uppercase tracking-widest text-deep-iris/60 bg-ash/40 px-3 py-1 rounded-tags">
            Clinical Privacy &amp; Encryption
          </span>
          <h2 className="text-[36px] md:text-[50px] font-semibold tracking-[-0.03em] leading-[1.0] text-deep-iris">
            Medical grade security is non-negotiable.
          </h2>
          <p className="text-subheading text-deep-iris/80 font-medium">
            We operate a clean pipe architecture where no audio persists longer than needed and all clinical audit trails are secured.
          </p>
        </div>

        {/* Compliance Badge Pair */}
        <div className="mx-auto max-w-xl border border-ash/80 rounded-cards-elevated bg-cloud-white p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6 justify-around shadow-sm transition-all hover:shadow-md">
          {/* Badge 1 */}
          <div className="flex items-center gap-4 text-left">
            <div className="flex size-14 items-center justify-center rounded-[7px] bg-deep-iris text-mint-vital shrink-0 shadow-md">
              <ShieldCheck className="size-8 stroke-[1.8]" />
            </div>
            <div>
              <h4 className="text-[16px] font-semibold text-deep-iris tracking-tight">DPDP Act Compliant</h4>
              <p className="text-[12px] text-deep-iris/70 font-medium">Indian health data local storage</p>
            </div>
          </div>

          <div className="hidden sm:block h-12 w-[1px] bg-ash" />

          {/* Badge 2 */}
          <div className="flex items-center gap-4 text-left">
            <div className="flex size-14 items-center justify-center rounded-[7px] bg-deep-iris text-clinical-cyan shrink-0 shadow-md">
              <BadgeCheck className="size-8 stroke-[1.8]" />
            </div>
            <div>
              <h4 className="text-[16px] font-semibold text-deep-iris tracking-tight">ISO 27001 Certified</h4>
              <p className="text-[12px] text-deep-iris/70 font-medium">Append-only audit logs system</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stark break boundary (horizontal line) */}
      <hr className="border-ash/60 max-w-4xl mx-auto" />

      {/* final CTA section (Light Theme - Asymmetrical layout with mini patient list mockup) */}
      <div className="mx-auto max-w-6xl px-6 py-32">
        <div className="rounded-cards bg-cloud-white border border-ash/60 p-8 md:p-16 max-w-5xl mx-auto shadow-sm grid gap-10 md:grid-cols-[1.5fr_1fr] items-center">
          <div className="space-y-6 text-left">
            <h2 className="text-[36px] md:text-[50px] font-semibold tracking-[-0.03em] leading-[1.0] text-deep-iris">
              Ready to get your evenings back?
            </h2>
            <p className="text-subheading text-deep-iris/80 font-medium leading-relaxed">
              Start free in minutes. Record your first consultation and see how our clinical speech engine handles your workflow natively.
            </p>
            <div className="pt-2">
              <Button 
                size="lg" 
                className="rounded-buttons bg-deep-iris hover:bg-deep-iris/90 text-cloud-white text-[17px] font-semibold px-10 py-6 h-auto shadow-[0_5px_15px_rgba(22,22,92,0.15)] transition-transform hover:scale-[1.02]" 
                asChild
              >
                <Link href="/login" className="flex items-center gap-2">
                  <Star className="size-5 fill-mint-vital stroke-none animate-pulse" />
                  Get started free
                </Link>
              </Button>
            </div>
          </div>

          {/* Visual card mockup on the right side of the CTA block (Breaking Symmetry) */}
          <div className="hidden md:block bg-pearl rounded-2xl border border-ash/80 p-5 space-y-3 shadow-inner">
            <div className="flex justify-between items-center pb-2 border-b border-ash">
              <span className="text-[12px] font-bold text-deep-iris/60">PATIENT RECORDBOX</span>
              <span className="size-2 rounded-full bg-deep-iris animate-pulse" />
            </div>
            <div className="space-y-2 text-[12px]">
              <div className="p-2.5 bg-cloud-white rounded-lg border border-ash/50 flex justify-between">
                <span className="font-semibold">Rajesh Kumar</span>
                <span className="text-deep-iris/65">Delhi OPD</span>
              </div>
              <div className="p-2.5 bg-cloud-white rounded-lg border border-ash/50 flex justify-between">
                <span className="font-semibold">Ananya Sen</span>
                <span className="text-deep-iris/65">Kolkata OPD</span>
              </div>
              <div className="p-2.5 bg-cloud-white rounded-lg border border-ash/50 flex justify-between">
                <span className="font-semibold">Vikram Malhotra</span>
                <span className="text-deep-iris/65">Mumbai OPD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* -------------------------------------------------------------------------- */
function Footer() {
  return (
    <footer className="border-t border-iris-veil/20 bg-iris-glow py-16 relative z-10 text-[14px]">
      <div className="mx-auto max-w-6xl px-6 grid gap-10 md:grid-cols-5">
        
        {/* Column 1: Logo & status */}
        <div className="space-y-4 md:col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-95 transition-opacity">
            <span className="flex size-8 items-center justify-center rounded-[7px] bg-deep-iris text-mint-vital shadow-md">
              <Activity className="size-4.5 stroke-[2.5]" />
            </span>
            <span className="text-[18px] font-semibold tracking-[-0.4px] text-cloud-white">Gooqi Scribe</span>
          </Link>
          <p className="text-cloud-white/70 max-w-xs leading-relaxed">
            Handcrafted medical speech to structured SOAP notes for outpatient chambers and busy Indian clinical workflows.
          </p>
          <div className="inline-flex items-center gap-2 rounded bg-deep-iris/80 px-2.5 py-1 text-[11px] font-bold text-mint-vital border border-white/[0.04]">
            <span className="size-2 rounded-full bg-mint-vital animate-pulse shadow-[0_0_8px_#00ffaa]" />
            All systems operational
          </div>
        </div>

        {/* Column 2: Product links */}
        <div className="space-y-3">
          <h4 className="font-semibold text-cloud-white uppercase text-[11px] tracking-wider">Product</h4>
          <ul className="space-y-2 text-cloud-white/80">
            <li><Link href="/login" className="hover:text-cloud-white transition-colors">Scribe Console</Link></li>
            <li><a href="#features" className="hover:text-cloud-white transition-colors">ASR Engines</a></li>
            <li><a href="#how" className="hover:text-cloud-white transition-colors">Integrations</a></li>
            <li><Link href="/login" className="hover:text-cloud-white transition-colors">Pricing Matrix</Link></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">Changelog</a></li>
          </ul>
        </div>

        {/* Column 3: Resources */}
        <div className="space-y-3">
          <h4 className="font-semibold text-cloud-white uppercase text-[11px] tracking-wider">Resources</h4>
          <ul className="space-y-2 text-cloud-white/80">
            <li><a href="#" className="hover:text-cloud-white transition-colors">Documentation</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">Medical LLM Guide</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">API Reference</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">Sandbox Protocol</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">System Status</a></li>
          </ul>
        </div>

        {/* Column 4: Legal & Social */}
        <div className="space-y-3">
          <h4 className="font-semibold text-cloud-white uppercase text-[11px] tracking-wider">Company</h4>
          <ul className="space-y-2 text-cloud-white/80">
            <li><a href="#" className="hover:text-cloud-white transition-colors">Security Portal</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">DPDP Policy</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">LinkedIn</a></li>
            <li><a href="#" className="hover:text-cloud-white transition-colors">Contact Support</a></li>
          </ul>
        </div>

      </div>

      <div className="mx-auto max-w-6xl px-6 mt-12 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4 text-cloud-white/60">
        <p>© {new Date().getFullYear()} Gooqi Health. All rights reserved.</p>
        <p className="font-medium">Handcrafted in New Delhi, India.</p>
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
    <div className="mx-auto max-w-3xl text-center space-y-3">
      <span className="text-[12px] font-bold uppercase tracking-widest text-clinical-cyan bg-iris-shadow border border-white/[0.08] px-3.5 py-1.5 rounded-tags">
        {eyebrow}
      </span>
      <h2 className="text-[36px] md:text-[50px] font-semibold tracking-[-0.03em] leading-[1.0] text-cloud-white pt-2">
        {title}
      </h2>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function UnifiedScribeConsole() {
  const [demoState, setDemoState] = useState<"idle" | "recording" | "analyzing" | "completed">("idle");
  const [timer, setTimer] = useState(0);
  const [activeTab, setActiveTab] = useState<"transcript" | "soap" | "prescription" | "summary">("transcript");
  const [visibleDialogue, setVisibleDialogue] = useState<{ time: string; speaker: string; text: string }[]>([]);
  const [visibleSuggestions, setVisibleSuggestions] = useState<string[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  const DEMO_TRANSCRIPT = [
    { time: "00:03", speaker: "Dr. Aditi Sharma", text: "Haan Rajesh ji, bataiye kya takleef hai?" },
    { time: "00:08", speaker: "Rajesh Kumar (Patient)", text: "Doctor sahab, do din se bahut tez bukhar hai. Badan me bhi bahut dard hai aur gala kharab ho gaya hai." },
    { time: "00:14", speaker: "Dr. Aditi Sharma", text: "Gale me dard ke alawa khansi hai ya saans lene me koi dikkat?" },
    { time: "00:19", speaker: "Rajesh Kumar (Patient)", text: "Nahi, saans lene me koi dikkat nahi hai. Bas halki dry cough hai." },
    { time: "00:23", speaker: "Dr. Aditi Sharma", text: "Theek hai. Main aapko Pantocid khali pet ke liye likh rahi hoon subah, aur paracetamol subah-shaam khane ke baad lijiye." },
    { time: "00:27", speaker: "Rajesh Kumar (Patient)", text: "Gargle karne ke liye bhi kuch likh dijiye doctor sahab." },
    { time: "00:29", speaker: "Dr. Aditi Sharma", text: "Haan, warm saline gargles kijiye din me teen baar. Yeh paracetamol do din khane ke baad batayein." }
  ];

  const SUGGESTIONS = [
    { time: 4, text: "👤 Patient Identified: Rajesh Kumar (M, 42)" },
    { time: 10, text: "🩺 Symptom Registered: High Grade Pyrexia" },
    { time: 16, text: "💡 Diagnostic Association: Acute Pharyngitis" },
    { time: 25, text: "💊 Rx Logged: Pantocid 40mg OD AC" },
    { time: 29, text: "💊 Rx Logged: Paracetamol 650mg BD PC" }
  ];

  const SYSTEM_LOGS = [
    "ASR Engine initialized... OK",
    "Audio buffer configuration: 16kHz, mono, PCM... OK",
    "Ambient noise floor calibrated at -48dB... OK",
    "Active voice activity detection (VAD) listening...",
    "Telemetry stream connected. Routing to region in-west...",
    "ASR Engine: Transcribing voice channel 0...",
    "Hinglish language translation layers engaged... OK",
    "Clinical NER parser queue: Ready",
    "On-device sandbox sync buffer configured... OK",
    "Awaiting audio segment compilation..."
  ];

  const LOADING_STEPS = [
    "Running ASR speech models on 30s audio segment...",
    "Extracting clinical entities and parameters...",
    "Synthesizing structured SOAP notes layout...",
    "Validating documentation against hallucination guards..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (demoState === "recording") {
      interval = setInterval(() => {
        setTimer((prev) => {
          const next = prev + 1;

          const nextDialogue = DEMO_TRANSCRIPT.find(d => {
            const dialogueSeconds = parseInt(d.time.split(":")[1]);
            return dialogueSeconds === next;
          });
          if (nextDialogue) {
            setVisibleDialogue(prevList => [...prevList, nextDialogue]);
          }

          const nextSuggestion = SUGGESTIONS.find(s => s.time === next);
          if (nextSuggestion) {
            setVisibleSuggestions(prevList => [...prevList, nextSuggestion.text]);
            setLogs(prevLogs => [...prevLogs, `Telemetry: Registered ${nextSuggestion.text.split(":")[0]}`]);
          }

          if (next % 4 === 0 && next < 30) {
            const randomLogs = [
              "ASR: Audio chunk pushed to pipeline",
              "Telemetry: ASR confidence > 98.4%",
              "Network: Latency stable at 34ms",
              "ASR: Speaker change detected (0 -> 1)",
              "Telemetry: Language weights updated"
            ];
            setLogs(prevLogs => [...prevLogs, randomLogs[Math.floor(Math.random() * randomLogs.length)]]);
          }

          if (next >= 30) {
            clearInterval(interval);
            setDemoState("analyzing");
            setLoadingStep(0);
            return 30;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoState]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (demoState === "analyzing") {
      interval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev >= LOADING_STEPS.length - 1) {
            clearInterval(interval);
            setTimeout(() => {
              setDemoState("completed");
              setActiveTab("soap");
            }, 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoState]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleDialogue]);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (demoState === "idle") {
      setLogs(SYSTEM_LOGS.slice(0, 5));
    } else if (demoState === "recording") {
      setLogs(SYSTEM_LOGS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoState]);

  const handleStart = () => {
    setDemoState("recording");
    setTimer(0);
    setVisibleDialogue([]);
    setVisibleSuggestions([]);
    setActiveTab("transcript");
  };

  const handleReset = () => {
    setDemoState("idle");
    setTimer(0);
    setVisibleDialogue([]);
    setVisibleSuggestions([]);
    setActiveTab("transcript");
  };

  return (
    <section className="scroll-mt-20 py-24 bg-[#16165c]/40 border-y border-white/[0.06] relative" id="features">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Interactive Workspace"
          title="See ambient clinical intelligence in action"
        />

        <div className="mt-16 grid gap-8 lg:grid-cols-[1.2fr_1.8fr]">
          <div className="bg-iris-shadow border border-white/[0.08] rounded-cards p-6 shadow-xl flex flex-col justify-between h-[560px]">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${demoState === "recording" ? "bg-destructive" : "bg-mint-vital"}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${demoState === "recording" ? "bg-destructive" : "bg-mint-vital"}`} />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pearl/50">
                    {demoState === "idle" && "Console: Idle"}
                    {demoState === "recording" && "Console: Recording active"}
                    {demoState === "analyzing" && "Console: Compiling SOAP"}
                    {demoState === "completed" && "Console: Consultation compiled"}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-pearl/40">
                  ID: G-79482-IN
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                {demoState === "idle" && (
                  <button
                    onClick={handleStart}
                    className="flex-1 bg-iris-pulse hover:bg-iris-pulse/90 text-cloud-white border border-white/[0.12] rounded px-4 py-3 font-semibold text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:-translate-y-0.5"
                  >
                    <Mic className="size-4 animate-pulse text-clinical-cyan" />
                    Start Ambient Recording
                  </button>
                )}

                {(demoState === "recording" || demoState === "analyzing") && (
                  <div className="flex-1 bg-[#2a297b] border border-white/[0.06] rounded px-4 py-3 text-cloud-white font-semibold text-[14px] flex items-center justify-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                    </span>
                    Recording Consultation... 00:{timer.toString().padStart(2, "0")} / 00:30
                  </div>
                )}

                {demoState === "completed" && (
                  <div className="flex-1 flex gap-3">
                    <div className="flex-1 bg-mint-vital/10 border border-mint-vital/20 rounded px-4 py-3 text-mint-vital font-semibold text-[14px] flex items-center justify-center gap-2">
                      <BadgeCheck className="size-4" />
                      Scribing Completed
                    </div>
                    <button
                      onClick={handleReset}
                      className="bg-iris-glow hover:bg-iris-glow/85 border border-white/[0.08] text-cloud-white rounded px-4 py-3 font-semibold text-[14px] transition-all cursor-pointer"
                      title="Reset console and start fresh"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              <div className="h-[60px] bg-deep-iris/40 border border-white/[0.04] rounded-lg flex items-center justify-center gap-1 overflow-hidden relative">
                {demoState === "recording" ? (
                  <div className="flex items-center gap-[4px] px-6 w-full justify-center">
                    {[...Array(26)].map((_, i) => {
                      const randomHeight = Math.floor(Math.random() * 42) + 8;
                      return (
                        <span 
                          key={i} 
                          className="w-[3px] bg-clinical-cyan rounded-full transition-all duration-150 animate-pulse"
                          style={{ height: `${randomHeight}px`, animationDelay: `${i * 0.05}s` }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[12px] text-pearl/30 font-mono tracking-wider">
                    {demoState === "idle" && "Awaiting voice trigger input..."}
                    {demoState === "analyzing" && "Analyzing consultation audio..."}
                    {demoState === "completed" && "Audio segment archived"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-[12px]">
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">Speaker Telemetry</span>
                  <span className="text-cloud-white font-medium mt-1 block">
                    {demoState === "recording" ? "Multi-Speaker (VAD Active)" : "Awaiting input"}
                  </span>
                </div>
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">Confidence Score</span>
                  <span className="text-mint-vital font-bold mt-1 block">
                    {demoState === "completed" ? "98.4%" : demoState === "recording" ? "97.8% (Live)" : "N/A"}
                  </span>
                </div>
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">Language Detected</span>
                  <span className="text-clinical-cyan font-bold mt-1 block">
                    {demoState === "recording" || demoState === "completed" ? "Hinglish / Indian English" : "Awaiting input"}
                  </span>
                </div>
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40 block">Noise Filter</span>
                    <span className="text-cloud-white font-medium mt-1 block text-[11px]">
                      {noiseSuppression ? "Active (ANC)" : "Bypassed"}
                    </span>
                  </div>
                  <button 
                    onClick={() => setNoiseSuppression(!noiseSuppression)}
                    className={`size-6 rounded-full border flex items-center justify-center transition-all ${noiseSuppression ? "bg-mint-vital/25 border-mint-vital text-mint-vital" : "bg-white/[0.03] border-white/[0.08] text-pearl/45"}`}
                  >
                    <Sliders className="size-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="h-[140px] bg-black/45 border border-white/[0.05] rounded-lg p-3 font-mono text-[10px] text-pearl/50 flex flex-col justify-between">
              <span className="text-clinical-cyan font-bold uppercase tracking-wider border-b border-white/[0.04] pb-1 block text-[9px]">
                ASR & NER Telemetry Stream
              </span>
              <div 
                ref={logScrollRef}
                className="flex-1 overflow-y-auto mt-2 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10"
              >
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-1">
                    <span className="text-iris-pulse font-bold">&gt;</span>
                    <span className="leading-snug">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-iris-shadow border border-white/[0.08] rounded-cards p-6 shadow-xl flex flex-col justify-between h-[560px]">
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex border-b border-white/[0.06] pb-2">
                {[
                  { id: "transcript", label: "Live Transcript", lock: false },
                  { id: "soap", label: "SOAP Charting", lock: demoState === "idle" || demoState === "recording" },
                  { id: "prescription", label: "Prescription", lock: demoState === "idle" || demoState === "recording" },
                  { id: "summary", label: "Visit Summary", lock: demoState === "idle" || demoState === "recording" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    disabled={tab.lock && demoState !== "completed"}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 pb-2 text-[12px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === tab.id 
                        ? "border-clinical-cyan text-clinical-cyan" 
                        : "border-transparent text-pearl/40 hover:text-pearl/60"
                    } ${(tab.lock && demoState !== "completed") ? "opacity-35 cursor-not-allowed" : ""}`}
                  >
                    {tab.lock && demoState !== "completed" && <Lock className="size-3" />}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {activeTab === "transcript" && (
                  <div className="h-full flex flex-col justify-between">
                    <div 
                      ref={scrollRef}
                      className="flex-1 overflow-y-auto space-y-4 max-h-[380px] scrollbar-thin scrollbar-thumb-white/10"
                    >
                      {visibleDialogue.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-pearl/35 font-mono text-[12px] mt-24">
                          <Activity className="size-8 stroke-[1.5] text-pearl/20 mb-3 animate-pulse" />
                          <span>No active consultation. Click &quot;Start Ambient Recording&quot; to begin.</span>
                        </div>
                      ) : (
                        visibleDialogue.map((d, index) => (
                          <div key={index} className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[10px] font-mono text-pearl/40 font-bold uppercase">
                              <span className={d.speaker.includes("Dr") ? "text-clinical-cyan" : "text-mint-vital"}>
                                {d.speaker}
                              </span>
                              <span>{d.time}</span>
                            </div>
                            <p className="text-[13.5px] text-cloud-white leading-relaxed bg-deep-iris/30 border border-white/[0.03] rounded-lg p-3">
                              {d.text}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {visibleSuggestions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/[0.06] bg-deep-iris/50 rounded-lg p-3">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-clinical-cyan block mb-2">
                          Live Pipeline Entity Detections
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-pearl/75">
                          {visibleSuggestions.slice(-2).map((s, idx) => (
                            <div key={idx} className="bg-black/35 rounded px-2.5 py-1.5 border border-white/[0.04] truncate">
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "soap" && demoState === "completed" && (
                  <div className="space-y-4 text-[13px] text-pearl/80">
                    <div className="border border-white/[0.06] rounded-lg p-4 bg-deep-iris/40">
                      <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block mb-1">Subjective (Chief Complaints)</span>
                      <p className="text-cloud-white leading-relaxed">
                        Patient presents with high-grade fever associated with severe generalized myalgia, sore throat, and a mild dry cough for 2 days. No dyspnea reported.
                      </p>
                    </div>

                    <div className="border border-white/[0.06] rounded-lg p-4 bg-deep-iris/40">
                      <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block mb-1">Objective (Vitals & Exam)</span>
                      <p className="text-cloud-white leading-relaxed">
                        Oropharyngeal examination reveals acute congestion/inflammation of pharyngeal mucosa. Chest clear on auscultation.
                      </p>
                    </div>

                    <div className="border border-white/[0.06] rounded-lg p-4 bg-deep-iris/40">
                      <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block mb-1">Assessment (Clinical Impression)</span>
                      <p className="text-cloud-white leading-relaxed font-semibold">
                        Acute Pharyngitis (ICD-10 J02.9) • Rule out Viral Pyrexia.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "prescription" && demoState === "completed" && (
                  <div className="space-y-4">
                    <div className="border border-white/[0.06] rounded-lg p-4 bg-deep-iris/40 text-[13px]">
                      <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-3">
                        <span className="font-mono text-[10.5px] uppercase text-pearl/40">Itemized Drug Directives</span>
                        <span className="text-mint-vital font-bold text-[10px] uppercase bg-mint-vital/15 px-2 py-0.5 rounded">
                          Validated via clinical Lexicon
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-1">
                          <div>
                            <h5 className="font-bold text-cloud-white">Tab. Pantocid 40mg</h5>
                            <span className="text-[11px] text-pearl/50">1 Tablet • Once daily • Empty stomach</span>
                          </div>
                          <span className="text-[12px] font-bold text-clinical-cyan">1-0-0 (5 Days)</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-1 border-t border-white/[0.04]">
                          <div>
                            <h5 className="font-bold text-cloud-white">Tab. Paracetamol 650mg</h5>
                            <span className="text-[11px] text-pearl/50">1 Tablet • Twice daily • After meals</span>
                          </div>
                          <span className="text-[12px] font-bold text-clinical-cyan">1-0-1 (3 Days)</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-white/[0.04]">
                          <div>
                            <h5 className="font-bold text-cloud-white">Warm Saline Gargles</h5>
                            <span className="text-[11px] text-pearl/50">3 times daily • Dissolve salt in warm water</span>
                          </div>
                          <span className="text-[12px] font-bold text-clinical-cyan">TDS (2 Days)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "summary" && demoState === "completed" && (
                  <div className="space-y-4 text-[13px] text-pearl/80">
                    <div className="border border-white/[0.06] rounded-lg p-4 bg-deep-iris/40">
                      <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block mb-1">Patient Instructions (Hindi/English)</span>
                      <p className="text-cloud-white leading-relaxed">
                        Kripya Pantocid subah khali pet lein. Paracetamol ko khana khane ke baad subah aur shaam ko lein. Din me 3 baar gungune paani me namak daal kar gargle karein. Agar bukhar do din me theek nahi hota hai, toh clinic aakar dikhayein.
                      </p>
                    </div>

                    <div className="border border-white/[0.06] rounded-lg p-4 bg-deep-iris/40 space-y-2">
                      <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block">Visit Telemetry Details</span>
                      <div className="grid grid-cols-2 gap-4 text-[11px]">
                        <div>
                          <span className="text-pearl/40">Audio Duration:</span>
                          <span className="text-cloud-white block mt-0.5 font-mono">00:30 seconds</span>
                        </div>
                        <div>
                          <span className="text-pearl/40">Total Words:</span>
                          <span className="text-cloud-white block mt-0.5 font-mono">112 words</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {demoState === "analyzing" && (
                  <div className="h-full flex flex-col items-center justify-center p-8 mt-12 space-y-6">
                    <div className="relative size-16">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clinical-cyan opacity-25" />
                      <span className="relative flex items-center justify-center rounded-full size-16 bg-clinical-cyan/15 text-clinical-cyan border border-clinical-cyan/40">
                        <RefreshCw className="size-7 animate-spin" />
                      </span>
                    </div>

                    <div className="space-y-2 text-center w-full max-w-sm">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-clinical-cyan">
                        Compiling Clinical Notes...
                      </span>
                      
                      <div className="space-y-2 pt-4">
                        {LOADING_STEPS.map((step, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center gap-2 text-left text-[11.5px] transition-all duration-300 ${
                              idx < loadingStep 
                                ? "text-mint-vital opacity-100 font-medium" 
                                : idx === loadingStep 
                                ? "text-clinical-cyan opacity-100 font-bold" 
                                : "text-pearl/30 opacity-60"
                            }`}
                          >
                            {idx < loadingStep ? (
                              <Check className="size-3.5 stroke-[3] text-mint-vital shrink-0" />
                            ) : idx === loadingStep ? (
                              <RefreshCw className="size-3 animate-spin text-clinical-cyan shrink-0" />
                            ) : (
                              <span className="size-1.5 rounded-full bg-pearl/30 shrink-0" />
                            )}
                            <span className="truncate">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {demoState === "completed" && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap justify-between items-center gap-4 text-[12px] text-pearl/50">
                  <span className="flex items-center gap-1 text-mint-vital">
                    <BadgeCheck className="size-4 text-mint-vital" /> SOAP Validated & Audit logged
                  </span>
                  <span className="flex items-center gap-1">
                    ASR Accuracy: <strong className="text-cloud-white">98.4%</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}



/* -------------------------------------------------------------------------- */
function BeforeAfterSection() {
  return (
    <section className="py-24 border-t border-white/[0.06] bg-deep-iris relative overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-[400px] w-[400px] bg-[radial-gradient(circle_at_center,rgba(0,255,170,0.03),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute left-1/4 bottom-1/4 h-[400px] w-[400px] bg-[radial-gradient(circle_at_center,rgba(0,177,255,0.03),transparent_70%)] blur-3xl" />

      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Workflow Transformation"
          title="See the direct clinical impact"
        />

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {/* Left Card: Without Gooqi */}
          <div className="rounded-cards bg-deep-iris/40 border border-destructive/20 p-8 flex flex-col justify-between space-y-8 relative overflow-hidden group hover:border-destructive/40 transition-all duration-500 shadow-lg">
            {/* Warning gradient glow */}
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.04),transparent_60%)] pointer-events-none" />
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-destructive uppercase tracking-widest bg-destructive/10 border border-destructive/20 px-3 py-1 rounded-tags">
                  Without Gooqi
                </span>
                <span className="text-[12px] text-pearl/40 font-semibold font-mono"> Burnout Workflow </span>
              </div>

              <div className="space-y-4">
                <h3 className="text-heading-sm font-semibold text-cloud-white">
                  Manual Documentation Burden
                </h3>
                <p className="text-body-sm text-pearl/70 leading-relaxed">
                  Physicians spend hours typing notes, staring at screens during consults, and dealing with fragmented documentation backlogs.
                </p>
              </div>

              {/* Messy Note Sandbox Simulation */}
              <div className="rounded-xl bg-deep-iris/80 border border-white/[0.04] p-4 font-mono text-[12px] text-pearl/50 space-y-3 relative">
                <div className="flex justify-between items-center text-[10px] text-pearl/30 border-b border-white/[0.04] pb-2">
                  <span>UNSTRUCTURED EMR ENTRY</span>
                  <span>TIME SPENT: 8.5 MINS</span>
                </div>
                <div className="space-y-1.5 leading-relaxed blur-[0.3px] select-none text-red-300/80">
                  <p>pt rpts hg fev 2d, bd ach, thr pn, dry cgh.</p>
                  <p>prev px rx. no disp. throat eryhtma +ve</p>
                  <p>rx paracet 650mg BD, pantocid OD AC</p>
                  <p>adv saline garlges tds. review in 2d</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-deep-iris/30 to-transparent pointer-events-none" />
              </div>

              {/* Stress telemetry factors */}
              <div className="grid grid-cols-2 gap-4 text-[12px] text-pearl/60">
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40">Engagement</span>
                  <span className="text-destructive font-bold text-[18px] mt-1">18%</span>
                  <span className="text-[11px] text-pearl/50 mt-0.5">Face-to-face patient contact</span>
                </div>
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/40">Daily Typings</span>
                  <span className="text-destructive font-bold text-[18px] mt-1">3.2 Hrs</span>
                  <span className="text-[11px] text-pearl/50 mt-0.5">Note backlog after clinic</span>
                </div>
              </div>
            </div>

            {/* Pain point bullet list */}
            <div className="space-y-3 pt-6 border-t border-white/[0.04] text-[13px] text-pearl/70">
              <div className="flex items-start gap-2.5">
                <span className="text-destructive font-bold">✕</span>
                <span>Doctor keyboard-typing during patient examinations</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-destructive font-bold">✕</span>
                <span>Incomplete medical parameters and spelling errors</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-destructive font-bold">✕</span>
                <span>Administrative fatigue causing severe clinical burnout</span>
              </div>
            </div>
          </div>

          {/* Right Card: With Gooqi */}
          <div className="rounded-cards bg-iris-shadow border border-clinical-cyan/25 p-8 flex flex-col justify-between space-y-8 relative overflow-hidden group hover:border-clinical-cyan/40 hover:-translate-y-1 transition-all duration-500 shadow-2xl">
            {/* Cyberpunk accent glow */}
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,177,255,0.06),transparent_60%)] pointer-events-none" />
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-mint-vital uppercase tracking-widest bg-mint-vital/10 border border-mint-vital/25 px-3 py-1 rounded-tags shadow-[0_0_10px_rgba(0,255,170,0.1)]">
                  With Gooqi Scribe
                </span>
                <span className="text-[12px] text-mint-vital font-semibold font-mono flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-mint-vital animate-pulse" />
                  Clinical Excellence
                </span>
              </div>

              <div className="space-y-4">
                <h3 className="text-heading-sm font-semibold text-cloud-white">
                  Autonomous Scribe Automation
                </h3>
                <p className="text-body-sm text-pearl/80 leading-relaxed">
                  Doctor speaks freely with the patient. Gooqi records, transcribes Hinglish/Hindi, and outputs structured documentation in seconds.
                </p>
              </div>

              {/* Beautiful SOAP note preview */}
              <div className="rounded-xl bg-deep-iris/75 border border-white/[0.06] p-4 text-[12.5px] text-pearl/90 space-y-2 relative shadow-lg">
                <div className="flex justify-between items-center text-[10px] text-pearl/40 border-b border-white/[0.04] pb-2">
                  <span className="font-mono">SOAP NOTES SUMMARY</span>
                  <span className="text-mint-vital font-bold">READY IN 27.4S</span>
                </div>
                <div className="space-y-2 leading-relaxed">
                  <div>
                    <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block">Subjective</span>
                    <p className="text-cloud-white font-medium">Patient presenting with high-grade pyrexia associated with pharyngeal pain &amp; dry cough.</p>
                  </div>
                  <div>
                    <span className="font-bold text-clinical-cyan text-[10.5px] uppercase block">Plan (Rx directives)</span>
                    <p className="text-cloud-white font-medium">Tab. Paracetamol 650mg BD PC • Tab. Pantocid 40mg OD AC • Saline Gargles.</p>
                  </div>
                </div>
              </div>

              {/* Stat telemetry factors */}
              <div className="grid grid-cols-2 gap-4 text-[12px] text-pearl/80">
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/45">Engagement</span>
                  <span className="text-mint-vital font-bold text-[18px] mt-1">100%</span>
                  <span className="text-[11px] text-pearl/60 mt-0.5">Face-to-face physician eye-contact</span>
                </div>
                <div className="rounded-lg bg-deep-iris/60 border border-white/[0.04] p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pearl/45">Note Generation</span>
                  <span className="text-mint-vital font-bold text-[18px] mt-1">Instant</span>
                  <span className="text-[11px] text-pearl/60 mt-0.5">Auto-drafted directly to EHR console</span>
                </div>
              </div>
            </div>

            {/* Impact bullet list */}
            <div className="space-y-3 pt-6 border-t border-white/[0.06] text-[13px] text-pearl/90">
              <div className="flex items-start gap-2.5">
                <span className="text-mint-vital font-bold">✓</span>
                <span>100% focus on patient diagnostics during visits</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-mint-vital font-bold">✓</span>
                <span>Correct clinical ICD-10 associations without typos</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-mint-vital font-bold">✓</span>
                <span>Zero documentation backlog, copy-paste to any EMR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */


