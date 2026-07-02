"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  KeyRound,
  Mail,
  MailCheck,
  Quote,
  ShieldCheck,
} from "lucide-react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { LoginBackground } from "@/components/auth/LoginBackground";

type View = "select" | "email" | "password";
type Stage = "email" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("select");
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function goSelect() {
    setView("select");
    setStage("email");
    setError(null);
  }

  async function oauth(provider: Provider) {
    setError(null);
    setOauthLoading(provider);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
      // On success the browser is redirected to the provider — nothing else to do.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not continue with ${provider}.`,
      );
      setOauthLoading(null);
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.replace("/sessions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setStage("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      router.replace("/sessions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  const heading =
    view === "select"
      ? { title: "Log in to your account", sub: "Choose an option to continue" }
      : view === "email"
        ? {
            title: "Continue with email",
            sub:
              stage === "email"
                ? "We'll email you a magic link and a code"
                : "Enter the code we emailed you",
          }
        : {
            title: "Continue with password",
            sub: "Sign in with your email and password",
          };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-background to-primary/5 px-4 py-10">
      <LoginBackground />

      {/* Side quote (large screens) */}
      <blockquote className="absolute bottom-12 left-12 hidden max-w-[220px] xl:block">
        <Quote className="size-6 text-primary/60" />
        <p className="mt-2 text-sm text-muted-foreground">
          Making clinical documentation faster, smarter and effortless.
        </p>
      </blockquote>

      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-xl">
          <CardBody className="p-6 sm:p-8">
            {/* Welcome header */}
            <div className="mb-5 flex flex-col items-center gap-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Activity className="size-6" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome to <span className="text-primary">Gooqi Scribe</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Your AI-powered medical documentation assistant
              </p>
            </div>

            {/* Section heading with divider */}
            <div className="mb-5 text-center">
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                <span className="relative inline-block bg-card px-3 font-semibold">
                  {heading.title}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{heading.sub}</p>
            </div>

            {error && (
              <p className="mb-4 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            {view === "select" && (
              <div className="space-y-3">
                <ProviderButton
                  icon={<GoogleIcon />}
                  label="Continue with Google"
                  onClick={() => oauth("google")}
                  loading={oauthLoading === "google"}
                />
                <ProviderButton
                  icon={<Mail className="size-5 text-primary" />}
                  label="Continue with Email"
                  onClick={() => {
                    setView("email");
                    setError(null);
                  }}
                />
                <ProviderButton
                  icon={<KeyRound className="size-5 text-muted-foreground" />}
                  label="Continue with Password"
                  onClick={() => {
                    setView("password");
                    setError(null);
                  }}
                />

                <p className="pt-3 text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setView("email");
                      setError(null);
                    }}
                  >
                    Create account
                  </button>
                </p>
              </div>
            )}

            {view === "email" && (
              <div className="space-y-4">
                {stage === "email" ? (
                  <form onSubmit={sendOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        autoFocus
                        placeholder="doctor@clinic.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" loading={loading}>
                      {loading ? "Sending…" : "Send sign-in code"}
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                      <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                      <p className="text-muted-foreground">
                        We sent a magic link and a 6-digit code to{" "}
                        <span className="font-medium text-foreground">
                          {email}
                        </span>
                        . Click the link, or enter the code below.
                      </p>
                    </div>
                    <form onSubmit={verify} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="code">6-digit code</Label>
                        <Input
                          id="code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="123456"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        loading={loading}
                        disabled={loading || otp.trim().length < 6}
                      >
                        {loading ? "Verifying…" : "Verify & sign in"}
                      </Button>
                    </form>
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => {
                        setStage("email");
                        setOtp("");
                        setError(null);
                      }}
                    >
                      Use a different email
                    </button>
                  </>
                )}
                <BackButton onClick={goSelect} />
              </div>
            )}

            {view === "password" && (
              <div className="space-y-4">
                <form onSubmit={signInWithPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-email">Email</Label>
                    <Input
                      id="pw-email"
                      type="email"
                      required
                      autoFocus
                      placeholder="doctor@clinic.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw">Password</Label>
                    <Input
                      id="pw"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" loading={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
                <BackButton onClick={goSelect} />
              </div>
            )}
          </CardBody>
        </Card>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary/70" />
          Your data is secure and encrypted
        </p>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
function ProviderButton({
  icon,
  label,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      All sign-in options
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

