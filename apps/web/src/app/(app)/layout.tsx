import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { CrashRecoveryBanner } from "@/components/recording/CrashRecoveryBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? undefined} />

      <CrashRecoveryBanner />

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
