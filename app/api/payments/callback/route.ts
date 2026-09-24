import { NextResponse } from "next/server";
import { localePath } from "@/lib/i18n";
import { getPaymentProvider } from "@/lib/payments";
import { siteUrl } from "@/lib/site";
import { getOrderStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/callback — sağlayıcı (mock/iyzico) buraya döner. İmza doğrulanır,
 * sipariş paid/payment_failed olur. Müşteri takip sayfasına 303 ile yönlendirilir.
 *
 * 24 Eyl 2026: paid'de web push GÖNDERİLMİYOR — kanal kaldırıldı, siparişler
 * WhatsApp'a düşüyor. Panel canlı akışı (realtime/SSE) yerinde duruyor.
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
  /* Dönen kayıt artık KULLANILMIYOR (push kalkınca okuyan kalmadı) ama güncelleme
     ŞART: siparişi paid/payment_failed yapan tek yer burası. Çağrı silinemez. */
  if (!wasPaid) {
    await store.update(result.orderId, {
      payment_status: result.status === "paid" ? "paid" : "payment_failed",
      payment_ref: result.ref ?? existing.payment_ref,
      status: "received",
    });
  }
  return NextResponse.redirect(siteUrl() + localePath(existing.locale, `/siparis/${existing.id}`), 303);
}
