import { NextResponse } from "next/server";
import { STATUSES, type Order, type OrderStatus } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/orders/[id] — takip sayfası (müşteri; uuid'yi bilen görür) */
export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
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
  let body: { status?: OrderStatus; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  if (!body.status || !STATUSES.includes(body.status)) return NextResponse.json({ error: "invalid-status" }, { status: 422 });
  const patch: Partial<Order> = { status: body.status };
  if (body.status === "cancelled") patch.cancel_reason = body.reason?.trim() || null;
  const order = await getOrderStore().update(id, patch);
  if (!order) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(order);
}
