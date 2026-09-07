import { NextResponse } from "next/server";
import { STATUSES, panelStage, type Order, type OrderStatus } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/orders/[id] — takip sayfası (müşteri; uuid'yi bilen görür) */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  /* uuid olmayan yol parçası (eski /api/orders/stream gibi) 500 yerine 404 dönsün */
  if (!UUID.test(id)) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const order = await getOrderStore().get(id);
  if (!order) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(order, { headers: { "cache-control": "no-store" } });
}

/**
 * PATCH /api/orders/[id] — durum güncelle (panel). Gövde: { status, reason? }
 * Yetki: lib/panel-auth (Supabase Bearer · PANEL_KEY başlık/çerez · üretimde anahtar yoksa 401).
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not-found" }, { status: 404 });
  let body: { status?: OrderStatus; reason?: string; prep_minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  if (!body.status || !STATUSES.includes(body.status)) return NextResponse.json({ error: "invalid-status" }, { status: 422 });
  const patch: Partial<Order> = { status: body.status };
  if (body.status === "cancelled") {
    patch.cancel_reason = body.reason?.trim() || null;
    patch.cancelled_at = new Date().toISOString();
  }
  /* Panel üç aşama: "Siparişi al" anında hazırlanma süresi ve kabul zamanı, kapanışta kapanış zamanı.
     Zaman damgaları SUNUCUDA yazılır (istemci saatine güvenilmez). */
  const cur = await getOrderStore().get(id);
  if (!cur) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const stage = panelStage(cur);
  if (stage === "new" && (body.status === "ready" || body.status === "on_the_way")) {
    patch.accepted_at = new Date().toISOString();
    const m = Number(body.prep_minutes);
    if (Number.isFinite(m) && m > 0 && m <= 240) patch.prep_minutes = Math.round(m);
  }
  if (body.status === "delivered") patch.closed_at = new Date().toISOString();
  const order = await getOrderStore().update(id, patch);
  if (!order) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(order);
}
