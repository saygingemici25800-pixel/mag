/**
 * Ortam anahtarları — ÇİFT YOL: Supabase anahtarları tanımlıysa Supabase, değilse yerel stub.
 * Anahtar gelince yalnızca .env.local dolar; kod değişmez.
 */

/** Sunucu: Supabase kullanılsın mı? (URL + service role) */
export function hasSupabaseServer(): boolean {
  return Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export function supabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}
/** İstemci: derleme anında gömülür (NEXT_PUBLIC_*). Auth + realtime için. */
export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const hasSupabaseClient = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY);

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
