import { NextResponse } from "next/server";
import { buildOrder, validateOrder, type NewOrderInput } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { sendNewOrderPush } from "@/lib/push";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUSH_TIMEOUT_MS = 3000;

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
  // Push: en fazla 3 sn bekle; hata/aşım siparişi etkilemez, yalnızca loglanır (Fluid Compute'a bağımlılık yok)
  try {
    await Promise.race([
      sendNewOrderPush(order),
      new Promise((_, rej) => setTimeout(() => rej(new Error("push timeout 3s")), PUSH_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.warn("[push]", (e as Error).message);
  }
  return NextResponse.json({ id: order.id, order }, { status: 201 });
}

/** GET /api/orders — panel listesi (yetkili). ?limit=200 */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit")) || 200);
  const orders = await getOrderStore().list(limit);
  return NextResponse.json(orders, { headers: { "cache-control": "no-store" } });
}
