import { NextResponse } from "next/server";
import { localePath } from "@/lib/i18n";
import { getPaymentProvider } from "@/lib/payments";
import { sendNewOrderPush } from "@/lib/push";
import { siteUrl } from "@/lib/site";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUSH_TIMEOUT_MS = 3000;

/**
 * POST /api/payments/callback — sağlayıcı (mock/iyzico) buraya döner. İmza doğrulanır, sipariş paid/payment_failed olur,
 * paid'de push (3 sn zaman aşımı). Müşteri takip sayfasına 303 ile yönlendirilir.
 */
export async function POST(req: Request) {
  const store = getOrderStore();
  let result;
  try {
    result = await getPaymentProvider().handleCallback(req);
  } catch (e) {
    console.warn("[payment callback]", (e as Error).message);
    return NextResponse.json({ error: "invalid-callback" }, { status: 400 });
  }
  const existing = await store.get(result.orderId);
  if (!existing) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const wasPaid = existing.payment_status === "paid";
  const order = wasPaid
    ? existing
    : await store.update(result.orderId, {
        payment_status: result.status === "paid" ? "paid" : "payment_failed",
        payment_ref: result.ref ?? existing.payment_ref,
        status: "received",
      });
  if (order && !wasPaid && result.status === "paid") {
    try {
      await Promise.race([sendNewOrderPush(order), new Promise((_, rej) => setTimeout(() => rej(new Error("push timeout 3s")), PUSH_TIMEOUT_MS))]);
    } catch (e) {
      console.warn("[push]", (e as Error).message);
    }
  }
  return NextResponse.redirect(siteUrl() + localePath(existing.locale, `/siparis/${existing.id}`), 303);
}
