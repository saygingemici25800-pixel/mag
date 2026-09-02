import { NextResponse } from "next/server";
import { after } from "next/server";
import { buildOrder, validateOrder, type NewOrderInput } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { sendNewOrderPush } from "@/lib/push";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/orders — sipariş oluştur (müşteri). 201 → { id, order }. Ardından panel aboneliklerine push. */
export async function POST(req: Request) {
  let input: NewOrderInput;
  try {
    input = (await req.json()) as NewOrderInput;
  } catch {
    return NextResponse.json({ errors: [{ field: "body", code: "invalid-json" }] }, { status: 400 });
  }
  const errors = validateOrder(input);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });
  const order = await getOrderStore().create(buildOrder(input));
  after(async () => {
    try {
      await sendNewOrderPush(order);
    } catch (e) {
      console.warn("[push]", (e as Error).message);
    }
  });
  return NextResponse.json({ id: order.id, order }, { status: 201 });
}

/** GET /api/orders — panel listesi (yetkili). ?limit=200 */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit")) || 200);
  const orders = await getOrderStore().list(limit);
  return NextResponse.json(orders, { headers: { "cache-control": "no-store" } });
}
