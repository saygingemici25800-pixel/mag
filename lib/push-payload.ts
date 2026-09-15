/**
 * Bildirim İÇERİĞİ — gönderim katmanından ayrı tutulur.
 *
 * Neden ayrı dosya: `lib/push.ts` web-push ve abonelik deposunu (Supabase/dosya)
 * içe aktarıyor. İçerik biçimi ise saf bir dönüşüm; testin bunu doğrulamak için
 * koca bir taşıma zincirini yüklemesi gerekmesin.
 */
import { shortId, type Order } from "@/lib/orders";

/** Bildirimde gösterilecek sipariş özeti. */
export type PushPayload = { title: string; body: string; url: string; tag: string };

/**
 * 15 Eyl 2026: başlık sabit "Yeni sipariş"; sipariş NO ve TUTAR gövdeye taşındı.
 * Önce tutar başlıktaydı ve sipariş no hiç yoktu — mutfak hangi sipariş olduğunu
 * bildirimden anlayamıyordu.
 * url: panelde O SİPARİŞE gider (#<id>); PanelApp hash'i okuyup karta kaydırır.
 */
export function newOrderPayload(order: Order): PushPayload {
  const summary = order.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
  return {
    title: "Yeni sipariş",
    body: `#${shortId(order.id)} · ₺${order.total} · ${order.type === "pickup" ? "Gel-al" : "Kurye"} · ${summary}`,
    url: `/panel#${order.id}`,
    tag: order.id,
  };
}
