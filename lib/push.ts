/** Web Push gönderimi (VAPID). Anahtar yoksa sessizce atlar. Süresi dolmuş abonelikleri (404/410) siler. */
import webpush from "web-push";
import type { Order } from "@/lib/orders";
import { getPushStore } from "@/lib/store";

let configured: boolean | null = null;
function ensureVapid(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@magstreetfood.example", pub, priv);
  return (configured = true);
}

export function newOrderPayload(order: Order) {
  const summary = order.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
  return {
    title: `Yeni sipariş · ₺${order.total}`,
    body: `${order.type === "pickup" ? "Gel-al" : "Kurye"} · ${summary}`,
    url: "/panel",
    tag: order.id,
  };
}

export async function sendNewOrderPush(order: Order): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) return { sent: 0, removed: 0 };
  const store = getPushStore();
  const subs = await store.list();
  const payload = JSON.stringify(newOrderPayload(order));
  let sent = 0,
    removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await store.remove(s.endpoint);
          removed++;
        } else console.warn("[push] gönderilemedi", s.endpoint.slice(0, 40), code ?? (e as Error).message);
      }
    }),
  );
  return { sent, removed };
}
