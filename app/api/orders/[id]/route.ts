import { NextResponse } from "next/server";
import type { Order, OrderStatus } from "@/lib/orders";
import { getOrderStore } from "@/lib/orders-store";

export const runtime = "nodejs";

const STATUSES: OrderStatus[] = ["alindi", "hazirlaniyor", "hazir", "yolda", "teslim", "iptal"];

/** GET /api/orders/[id] — takip sayfası buradan yoklar (Faz 3: realtime) */
export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const order = await getOrderStore().get(id);
  if (!order) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(order, { headers: { "cache-control": "no-store" } });
}

/**
 * PATCH /api/orders/[id] — durum güncelle (panel). Gövde: { status, reason? }
 * Geçici koruma: PANEL_KEY tanımlıysa `x-panel-key` başlığı eşleşmeli. Faz 3'te Supabase Auth.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const key = process.env.PANEL_KEY;
  if (key && req.headers.get("x-panel-key") !== key) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { status?: OrderStatus; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  if (!body.status || !STATUSES.includes(body.status)) return NextResponse.json({ error: "invalid-status" }, { status: 422 });
  const patch: Partial<Order> = { status: body.status };
  if (body.status === "iptal") patch.cancel_reason = body.reason?.trim() || null;
  const order = await getOrderStore().update(id, patch);
  if (!order) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(order);
}
