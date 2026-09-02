/**
 * Panel yetkisi — ÇİFT YOL:
 *  - Supabase varsa: `Authorization: Bearer <access_token>` (Supabase Auth, e-posta/şifre).
 *  - Yoksa: PANEL_KEY. `x-panel-key` başlığı ya da 30 günlük imzalı httpOnly çerez (`mag_panel`).
 *  - PANEL_KEY tanımsız: geliştirmede açık, üretimde (NODE_ENV=production) her zaman 401.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { hasSupabaseServer, isProduction } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";

export const PANEL_COOKIE = "mag_panel";
export const PANEL_COOKIE_DAYS = 30;

export type PanelMode = "supabase" | "key" | "open";
export function panelMode(): PanelMode {
  if (hasSupabaseServer()) return "supabase";
  if (process.env.PANEL_KEY) return "key";
  return isProduction() ? "key" : "open"; // üretimde anahtar yoksa da "key" modu → hiç kimse geçemez
}

function sign(exp: number): string {
  return createHmac("sha256", process.env.PANEL_KEY || "").update(String(exp)).digest("base64url");
}
export function makePanelToken(): { token: string; maxAge: number } {
  const exp = Date.now() + PANEL_COOKIE_DAYS * 86400_000;
  return { token: `${exp}.${sign(exp)}`, maxAge: PANEL_COOKIE_DAYS * 86400 };
}
function verifyPanelToken(token: string | undefined): boolean {
  if (!token || !process.env.PANEL_KEY) return false;
  const [expS, sig] = token.split(".");
  const exp = Number(expS);
  if (!exp || !sig || exp < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
export function checkPanelKey(key: string | null | undefined): boolean {
  const k = process.env.PANEL_KEY;
  if (!k || !key) return false;
  const a = Buffer.from(k),
    b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function isPanelAuthorized(req: Request): Promise<boolean> {
  const mode = panelMode();
  if (mode === "open") return true;
  if (mode === "supabase") {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return false;
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    return !error && Boolean(data.user);
  }
  // key modu
  if (!process.env.PANEL_KEY) return false; // üretim, anahtar yok → kapalı
  if (checkPanelKey(req.headers.get("x-panel-key"))) return true;
  return verifyPanelToken(cookieValue(req, PANEL_COOKIE));
}
