"use client";

import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const getApiUrl = (): string => {
  // A trailing slash here (e.g. NEXT_PUBLIC_API_URL="https://api.example.com/")
  // would double up with paths that already start with "/" (".../api/sessions"
  // -> ".../<empty>/api/sessions"), 404ing every request — strip it once here
  // rather than trusting every path/env-var combination to avoid it.
  const defaultUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isLocalhost) {
      try {
        const url = new URL(defaultUrl);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
          url.hostname = window.location.hostname;
          return url.toString().replace(/\/$/, "");
        }
      } catch {
        // Fallback to defaultUrl
      }
    }
  }
  return defaultUrl;
};

export const API_URL = getApiUrl();

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

/**
 * Low-level JSON fetch helper. Prefixes NEXT_PUBLIC_API_URL, attaches the
 * bearer token and JSON headers, and throws ApiError on non-2xx.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, token, signal } = opts;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  return parseResponse<T>(res);
}

/**
 * Multipart variant for chunk upload. Does NOT set Content-Type so the browser
 * adds the correct multipart boundary.
 */
export async function apiFetchMultipart<T = unknown>(
  path: string,
  formData: FormData,
  opts: { method?: string; token?: string | null; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "POST", token, signal } = opts;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: formData,
    signal,
  });

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : undefined) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

/**
 * Client hook that resolves the current Supabase access token and exposes
 * token-bound API helpers.
 */
export function useApi() {
  const supabase = useMemo(() => createClient(), []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const request = useCallback(
    async <T = unknown>(
      path: string,
      opts: Omit<ApiFetchOptions, "token"> = {},
    ): Promise<T> => {
      const token = await getToken();
      return apiFetch<T>(path, { ...opts, token });
    },
    [getToken],
  );

  const requestMultipart = useCallback(
    async <T = unknown>(
      path: string,
      formData: FormData,
      opts: { method?: string; signal?: AbortSignal } = {},
    ): Promise<T> => {
      const token = await getToken();
      return apiFetchMultipart<T>(path, formData, { ...opts, token });
    },
    [getToken],
  );

  return { request, requestMultipart, getToken };
}
