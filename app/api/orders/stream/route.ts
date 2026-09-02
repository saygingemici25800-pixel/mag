import { orderEvents, type OrderEvent } from "@/lib/events";
import type { Order } from "@/lib/orders";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { getOrderStore, storeMode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;
const POLL_MS = 3_000;

/**
 * GET /api/orders/stream — Server-Sent Events.
 *  - ?id=<uuid>: tek siparişin durumu (müşteri takip). Yetki gerekmez (uuid'yi bilen).
 *  - id yok: tüm siparişler (panel, yetkili). Supabase modunda panel realtime kullanır; burası yine de çalışır.
 * Stub modunda süreç içi olaylar; Supabase modunda sunucu 3 sn'de bir sorgular ve değişince yayar.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id && !(await isPanelAuthorized(req))) return new Response("unauthorized", { status: 401 });

  const enc = new TextEncoder();
  const store = getOrderStore();
  let closed = false;
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      send("hello", { mode: storeMode(), id });

      // ilk durum
      if (id) {
        const o = await store.get(id);
        if (o) send("order", { type: "update", order: o });
      }

      const hb = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`: hb\n\n`));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      let poll: ReturnType<typeof setInterval> | null = null;
      const onEvent = (ev: OrderEvent) => {
        if (id && ev.order.id !== id) return;
        send("order", ev);
      };

      if (storeMode() === "stub") {
        orderEvents().on("order", onEvent);
      } else {
        // Supabase: sunucu tarafı yoklama (müşteri anon olduğu için RLS realtime'a izin vermez)
        let last = new Map<string, string>();
        const snapshot = (o: Order) => `${o.status}|${o.cancel_reason ?? ""}`;
        if (id) {
          const o = await store.get(id);
          if (o) last.set(o.id, snapshot(o));
        } else {
          for (const o of await store.list(200)) last.set(o.id, snapshot(o));
        }
        poll = setInterval(async () => {
          if (closed) return;
          try {
            const rows = id ? [await store.get(id)].filter((x): x is Order => Boolean(x)) : await store.list(200);
            const next = new Map<string, string>();
            for (const o of rows) {
              next.set(o.id, snapshot(o));
              const prev = last.get(o.id);
              if (prev === undefined && !id) send("order", { type: "insert", order: o });
              else if (prev !== undefined && prev !== snapshot(o)) send("order", { type: "update", order: o });
            }
            last = next;
          } catch (e) {
            console.warn("[stream] poll", (e as Error).message);
          }
        }, POLL_MS);
      }

      cleanup = () => {
        closed = true;
        clearInterval(hb);
        if (poll) clearInterval(poll);
        orderEvents().off("order", onEvent);
        try {
          controller.close();
        } catch {
          /* zaten kapalı */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
