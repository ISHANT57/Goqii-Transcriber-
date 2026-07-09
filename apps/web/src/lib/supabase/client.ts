"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Safe to call from client components.
 * Reads the public anon key; never the service role key.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fallbacks to allow Next.js static prerendering to succeed during build time
    return createBrowserClient("https://mock.supabase.co", "mock-key");
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  );
}
