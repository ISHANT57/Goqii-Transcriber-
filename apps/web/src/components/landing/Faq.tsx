"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Gooqi Scribe?",
    a: "An ambient AI medical scribe. It records the doctor–patient consultation, transcribes it with speaker labels, and generates a structured SOAP note and prescription for you to review and sign off.",
  },
  {
    q: "Which languages are supported?",
    a: "Indian English, Hindi and mixed Hinglish out of the box, with additional regional languages available depending on the speech provider configured.",
  },
  {
    q: "Is patient data secure?",
    a: "Consent is a hard gate before any recording, every consent is written to an append-only audit log, and audio is stored in a private, access-controlled bucket. The pipeline is designed to be DPDP-ready.",
  },
  {
    q: "What happens if my internet drops mid-consultation?",
    a: "Recording is crash-safe: audio is saved on the device in 30-second chunks as you record, so a refresh or lost connection never loses the visit. Pending chunks upload automatically when you reconnect.",
  },
  {
    q: "Can I edit the note before it's final?",
    a: "Yes. Every note opens as an editable draft — transcript, SOAP fields and prescriptions — and autosaves as you work. Nothing is finalised until you sign off.",
  },
  {
    q: "Can I manage patients and see past visits?",
    a: "Yes. Every consultation is linked to a patient record, and each patient has a profile with their full visit history so you can pull up earlier notes in a couple of clicks.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <Card key={i} className="overflow-hidden">
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="font-medium">{item.q}</span>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-all duration-200",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm text-muted-foreground">
                  {item.a}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
