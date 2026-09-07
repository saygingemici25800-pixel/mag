import { NextResponse } from "next/server";
import { defaultNow } from "@/lib/hours";
import type { Order } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "Europe/Istanbul";
/** "YYYY-MM-DD" — İstanbul saatiyle gün (UTC kayması gün sonunu bir gün öteye atmasın) */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // en-CA → 2026-09-06
}

export interface DaySummary {
  date: string;
  /** iptal hariç, ödemesi alınmış sipariş sayısı */
  orders: number;
  /** toplam ciro (₺) */
  revenue: number;
  /** en çok satan ürün */
  topItem: { name: string; qty: number } | null;
  /** ortalama hazırlanma süresi (dakika) — kabul → kapanış; yoksa girilen prep_minutes */
  avgPrepMinutes: number | null;
  cancelled: number;
}

/** GET /api/panel/summary?date=YYYY-MM-DD — gün sonu özeti (varsayılan: bugün) */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || dayKey(defaultNow().toISOString());
  const all = await getOrderStore().list(1000, false);
  const day = all.filter((o: Order) => dayKey(o.created_at) === date);
  const paid = day.filter((o) => o.payment_status === "paid" && o.status !== "cancelled");

  const counts = new Map<string, { name: string; qty: number }>();
  for (const o of paid) {
    for (const it of o.items) {
      const cur = counts.get(it.id) ?? { name: it.name, qty: 0 };
      cur.qty += it.qty;
      counts.set(it.id, cur);
    }
  }
  const topItem = [...counts.values()].sort((a, b) => b.qty - a.qty)[0] ?? null;

  /* Hazırlanma süresi: gerçekleşen (kabul → kapanış) varsa o, yoksa panelde girilen tahmin */
  const durations: number[] = [];
  for (const o of paid) {
    /* Gerçekleşen süre (kabul → kapanış) yalnızca anlamlıysa kullanılır: panelde arka arkaya
       tıklanan test siparişleri 0 dk üretiyor ve ortalamayı bozuyordu. 1 dk altındaysa
       işletmenin girdiği tahmine (prep_minutes) düşülür. */
    const real = o.accepted_at && o.closed_at ? (new Date(o.closed_at).getTime() - new Date(o.accepted_at).getTime()) / 60000 : null;
    if (real !== null && real >= 1) durations.push(real);
    else if (typeof o.prep_minutes === "number") durations.push(o.prep_minutes);
  }
  const avgPrepMinutes = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;

  const body: DaySummary = {
    date,
    orders: paid.length,
    revenue: paid.reduce((s, o) => s + o.total, 0),
    topItem,
    avgPrepMinutes,
    cancelled: day.filter((o) => o.status === "cancelled").length,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
