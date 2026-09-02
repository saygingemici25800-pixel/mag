"use client";

/** Panel istemci yardımcıları — Supabase varsa Bearer token, yoksa çerez (PANEL_KEY kapısı). */
import { hasSupabaseClient } from "@/lib/env";
import { supabaseBrowser } from "@/lib/supabase";

export async function authHeaders(): Promise<Record<string, string>> {
  if (!hasSupabaseClient) return {};
  const sb = supabaseBrowser();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(await authHeaders()), ...(init.headers as Record<string, string> | undefined) };
  return fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
}
