"use client";

import * as React from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/toaster";

/**
 * App-wide client providers: theming (dark/light), tooltips, imperative
 * confirm dialogs, and toast notifications.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
