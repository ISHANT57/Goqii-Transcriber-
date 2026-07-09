import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client for Server Components / Route Handlers.
 * Next 15: `cookies()` is async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fallbacks to allow Next.js static prerendering to succeed during build time
    supabaseUrl = "https://mock.supabase.co";
    supabaseAnonKey = "mock-key";
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where mutating cookies is not
            // allowed. The middleware refreshes the session, so this is safe
            // to ignore.
          }
        },
      },
    },
  );
}
