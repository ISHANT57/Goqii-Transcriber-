import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link / OTP callback. Exchanges the `code` query param for a session,
 * then redirects to the sessions list (or `next` if provided).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/sessions";

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error("Auth exchange error:", error);
    }

    return NextResponse.redirect(`${new URL(request.url).origin}/login?error=auth`);
  } catch (err: any) {
    console.error("Callback route error:", err);
    return NextResponse.json({ error: "Internal Server Error", message: err.message }, { status: 500 });
  }
}
