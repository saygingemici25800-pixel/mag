import { NextResponse } from "next/server";
import { isPanelAuthorized } from "@/lib/panel-auth";
import type { Settings } from "@/lib/settings";
import { getSettingsStore } from "@/lib/store";
import { normalizeZones } from "@/lib/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/panel/settings — herkese açık OKUMA: site "kapalıyız" ve "tükendi" durumunu bilmeli. */
export async function GET() {
  const s = await getSettingsStore().get();
  return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
}

/** PATCH /api/panel/settings — YALNIZCA panel (PANEL_KEY). Yazma buradan geçer;
    service_role yalnızca sunucuda kullanılır, tarayıcıya hiç gitmez.
    Gövde: { ordering_open?, sold_out?, zones? } */
export async function PATCH(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Partial<Pick<Settings, "ordering_open" | "sold_out" | "zones">>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const patch: Partial<Pick<Settings, "ordering_open" | "sold_out" | "zones">> = {};
  if (typeof body.ordering_open === "boolean") patch.ordering_open = body.ordering_open;
  if (Array.isArray(body.sold_out)) patch.sold_out = body.sold_out.filter((x): x is string => typeof x === "string");
  /* Bölgeler: ŞEMA SUNUCUDA doğrulanır (normalizeZones) — tarayıcıdan gelen ham
     veriye güvenilmez. Geçerli kayıt kalmazsa 422; boş liste kazayla tüm
     teslimatı kapatmasın. Bölgeyi kapatmak için active:false kullanılır. */
  if (body.zones !== undefined) {
    if (!Array.isArray(body.zones)) return NextResponse.json({ error: "zones-invalid" }, { status: 422 });
    const z = normalizeZones(body.zones);
    if (!z) return NextResponse.json({ error: "zones-empty" }, { status: 422 });
    const ids = new Set(z.map((x) => x.id));
    if (ids.size !== z.length) return NextResponse.json({ error: "zones-duplicate-id" }, { status: 422 });
    patch.zones = z;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "empty-patch" }, { status: 422 });
  return NextResponse.json(await getSettingsStore().patch(patch));
}
