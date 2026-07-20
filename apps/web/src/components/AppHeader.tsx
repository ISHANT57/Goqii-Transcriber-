"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  History,
  LogOut,
  Mic,
  Settings,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/sessions/new", label: "New Session", icon: Mic },
  { href: "/sessions", label: "History", icon: History },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

function initials(email?: string) {
  if (!email) return "DR";
  const local = email.split("@")[0].replace(/[^a-zA-Z]/g, "");
  return (local.slice(0, 2) || "DR").toUpperCase();
}

export function AppHeader({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 print:hidden">
      <div className="mx-auto flex h-14 sm:h-16 max-w-[1440px] items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8">
        <Link href="/sessions" className="flex items-center gap-2 shrink-0">
          <span className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4 sm:size-5" />
          </span>
          <span className="leading-tight hidden sm:block">
            <span className="block font-semibold">Gooqi Scribe</span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              AI Medical Documentation
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/sessions"
                ? pathname === "/sessions"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 sm:px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden xs:flex">
                <Bell className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="normal-case">
                Notifications
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                You&apos;re all caught up — no new notifications.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Account */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-0.5 sm:ml-1 inline-flex items-center gap-1 sm:gap-1.5 rounded-full py-1 pl-1 pr-1.5 sm:pr-2 transition-colors hover:bg-muted">
                <span className="flex size-7 sm:size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(email)}
                </span>
                <ChevronDown className="size-3.5 sm:size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {email && (
                <>
                  <DropdownMenuLabel className="max-w-[14rem] truncate normal-case">
                    {email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
