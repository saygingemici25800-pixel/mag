import { NextResponse } from "next/server";
import { isPanelAuthorized } from "@/lib/panel-auth";
import type { Settings } from "@/lib/settings";
import { getSettingsStore } from "@/lib/store";
import { normalizeZones } from "@/lib/zones";
import { normalizePrices, normalizeSchedule, pruneSpecial } from "@/lib/settings";
import { defaultNow, istanbulDateKey } from "@/lib/hours";
import { findMenuItem } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/panel/settings — herkese açık OKUMA: site "kapalıyız" ve "tükendi" durumunu bilmeli. */
export async function GET() {
  const s = await getSettingsStore().get();
  return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
}

/** PATCH /api/panel/settings — YALNIZCA panel (PANEL_KEY). Yazma buradan geçer;
    service_role yalnızca sunucuda kullanılır, tarayıcıya hiç gitmez.
    Gövde: { ordering_open?, delivery_open?, pickup_open?, sold_out?, zones?, prices?, schedule? } */
export async function PATCH(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Partial<Pick<Settings, "ordering_open" | "delivery_open" | "pickup_open" | "sold_out" | "zones" | "prices" | "schedule">>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const patch: Partial<Pick<Settings, "ordering_open" | "delivery_open" | "pickup_open" | "sold_out" | "zones" | "prices" | "schedule">> = {};
  if (typeof body.ordering_open === "boolean") patch.ordering_open = body.ordering_open;
  if (typeof body.delivery_open === "boolean") patch.delivery_open = body.delivery_open;
  if (typeof body.pickup_open === "boolean") patch.pickup_open = body.pickup_open;
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
  /* Fiyatlar: şema SUNUCUDA doğrulanır — pozitif TAM SAYI ve BİLİNEN ürün id'si.
     Geçersiz kayıt sessizce atılmaz, 422 döner: panel hangi alanın hatalı
     olduğunu görsün (sessiz atma "kaydettim" yanılgısı yaratıyordu). */
  if (body.prices !== undefined) {
    if (!body.prices || typeof body.prices !== "object" || Array.isArray(body.prices)) {
      return NextResponse.json({ error: "prices-invalid" }, { status: 422 });
    }
    const bad: string[] = [];
    for (const [id, v] of Object.entries(body.prices as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (!findMenuItem(id)) bad.push(id + ":unknown-item");
      else if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) bad.push(id + ":not-positive-integer");
    }
    if (bad.length) return NextResponse.json({ error: "prices-invalid", fields: bad }, { status: 422 });
    patch.prices = normalizePrices(body.prices);
  }
  /* Program: şema SUNUCUDA doğrulanır (normalizeSchedule) — bozuk pencere
     varsayılana düşer, geçersiz özel gün atılır. Geçmiş tarihli özel günler
     her yazmada AYIKLANIR ki liste şişmesin.
     "Bugün" defaultNow()'dan okunur (new Date() DEĞİL): uygulamanın geri kalanı
     da ondan okuyor. Aksi halde test ortamında (MAG_FAKE_NOW ile zaman donmuşken)
     sunucunun yaşadığı güne özel gün eklenemiyordu — iki farklı "bugün" oluşuyordu.
     Canlıda MAG_FAKE_NOW yok sayıldığı için davranış değişmez. */
  if (body.schedule !== undefined) {
    const sch = normalizeSchedule(body.schedule);
    patch.schedule = { week: sch.week, special: pruneSpecial(sch.special, istanbulDateKey(defaultNow())) };
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "empty-patch" }, { status: 422 });
  try {
    return NextResponse.json(await getSettingsStore().patch(patch));
  } catch (e) {
    /* Şema eksikse (migration uygulanmamış) sessizce "kaydedildi" DEMEYİZ:
       panel hatayı görsün, işletme veri kaybettiğini sanmasın. */
    console.error("[panel settings]", (e as Error).message);
    return NextResponse.json({ error: "save-failed", detail: (e as Error).message }, { status: 500 });
  }
}
