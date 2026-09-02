import { NextResponse } from "next/server";
import { isProduction } from "@/lib/env";
import { PANEL_COOKIE, checkPanelKey, makePanelToken, panelMode } from "@/lib/panel-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/panel/login { key } — PANEL_KEY kapısı (Supabase yokken). 30 günlük httpOnly çerez. */
export async function POST(req: Request) {
  if (panelMode() === "supabase") return NextResponse.json({ error: "use-supabase-auth" }, { status: 400 });
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (!checkPanelKey(key)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { token, maxAge } = makePanelToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PANEL_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", maxAge });
  return res;
}

/** DELETE — çıkış */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PANEL_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", maxAge: 0 });
  return res;
}
