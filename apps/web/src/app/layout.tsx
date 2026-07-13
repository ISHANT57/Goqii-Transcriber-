import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["500", "600"],
  // Paint immediately with the fallback, then swap in the webfont (no FOIT).
  display: "swap",
  // The font is applied through a CSS variable (--font-sans) consumed by
  // Tailwind's `font-sans`, so Next can't tell which weight is used above the
  // fold and eagerly preloads both — triggering Chrome's "preloaded but not
  // used" warning for the weight that isn't on screen within a few seconds.
  // Disabling the preload removes the wasted hint; the font still loads from
  // the same-origin /_next/static bundle and swaps in near-instantly.
  preload: false,
});

export const metadata: Metadata = {
  title: "Gooqi Scribe",
  description: "Clinical consultation transcription and note generation.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gooqi Scribe",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakarta.variable} min-h-screen font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
