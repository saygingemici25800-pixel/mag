import { NextResponse } from "next/server";
import { buildOrder, validateOrder, type NewOrderInput } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { getPaymentProvider } from "@/lib/payments";
import { siteUrl } from "@/lib/site";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders — sipariş oluştur (awaiting_payment) + ödeme sağlayıcısında checkout aç.
 * 201 → { id, redirectUrl }. Push ve panel bildirimi ödeme callback'inde (paid) olur.
 */
export async function POST(req: Request) {
  let input: NewOrderInput;
  try {
    input = (await req.json()) as NewOrderInput;
  } catch {
    return NextResponse.json({ errors: [{ field: "body", code: "invalid-json" }] }, { status: 400 });
  }
  const errors = validateOrder(input);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });
  let provider;
  try {
    provider = getPaymentProvider();
  } catch (e) {
    console.error("[payment]", (e as Error).message);
    return NextResponse.json({ errors: [{ field: "payment", code: "provider-unavailable" }] }, { status: 503 });
  }
  const store = getOrderStore();
  const order = await store.create(buildOrder(input));
  try {
    const { redirectUrl, ref } = await provider.createCheckout(order, { baseUrl: siteUrl() });
    await store.update(order.id, { payment_ref: ref });
    return NextResponse.json({ id: order.id, redirectUrl }, { status: 201 });
  } catch (e) {
    console.error("[payment checkout]", (e as Error).message);
    await store.update(order.id, { payment_status: "payment_failed" });
    return NextResponse.json({ id: order.id, errors: [{ field: "payment", code: "checkout-failed" }] }, { status: 502 });
  }
}

/** GET /api/orders — panel listesi (yetkili). ?limit=200 */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit")) || 200);
  const orders = await getOrderStore().list(limit, true); // panel: yalnızca ödenmiş
  return NextResponse.json(orders, { headers: { "cache-control": "no-store" } });
}
