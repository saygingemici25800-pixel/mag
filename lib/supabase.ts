/** Supabase istemcileri. Sunucu: service role (RLS'yi geçer, yalnızca API rotalarında). Tarayıcı: anon + auth oturumu. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL, hasSupabaseClient, supabaseUrl } from "@/lib/env";

let admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

let browser: SupabaseClient | null = null;
/** Tarayıcı istemcisi; Supabase yapılandırılmamışsa null (stub yolu). */
export function supabaseBrowser(): SupabaseClient | null {
  if (!hasSupabaseClient) return null;
  if (!browser) browser = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
  return browser;
}
