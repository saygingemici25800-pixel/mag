import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { siteUrl } from "@/lib/site";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/payments/retry { id } — ödenmemiş sipariş için yeni checkout → { redirectUrl } */
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  const store = getOrderStore();
  const order = await store.get(id);
  if (!order) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "already-paid" }, { status: 409 });
  try {
    const { redirectUrl, ref } = await getPaymentProvider().createCheckout(order, { baseUrl: siteUrl() });
    await store.update(id, { payment_status: "awaiting_payment", payment_ref: ref });
    return NextResponse.json({ redirectUrl });
  } catch (e) {
    console.warn("[payment retry]", (e as Error).message);
    return NextResponse.json({ error: "provider" }, { status: 502 });
  }
}
