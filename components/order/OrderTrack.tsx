"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { STATUS_FLOW, type Order } from "@/lib/orders";
import { formatPrice } from "@/lib/menu";
import { getZone } from "@/lib/zones";
import { SITE } from "@/lib/site";
import "./order.css";

const t = getMessages("tr");
const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const POLL_MS = 10_000;

/** /siparis/[id] — durum: alındı → hazırlanıyor → hazır/yolda → teslim. 10 sn'de bir yoklar (Faz 3: realtime). */
export default function OrderTrack({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);
  const tr = t.track;

  useEffect(() => {
    if (order.status === "teslim" || order.status === "iptal") return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (res.ok) setOrder(await res.json());
      } catch {
        /* sonraki tur */
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [order.id, order.status]);

  const flow = STATUS_FLOW[order.type];
  const idx = order.status === "iptal" ? -1 : flow.indexOf(order.status);

  return (
    <main className="ord">
      <div className="mx-auto max-w-2xl">
        <div className="ord-label">
          {tr.id} · {order.id}
        </div>
        <h1 className="big in mt-4">
          <span>
            <i>{tr.title[0]}</i>
          </span>
          <span>
            <i>{order.status === "iptal" ? tr.steps.iptal.split(" ")[0] : tr.title[1]}</i>
          </span>
        </h1>
        <p className="mt-4 max-w-md text-dim">
          {order.type === "pickup" ? fmt(tr.pickupHint, { address: SITE.address }) : tr.deliveryHint}
        </p>

        <div className="steps mt-8">
          {order.status === "iptal" ? (
            <div className="step now">
              <i>×</i>
              <span>
                {tr.steps.iptal}
                {order.cancel_reason ? ` — ${tr.cancelReason}: ${order.cancel_reason}` : ""}
              </span>
            </div>
          ) : (
            flow.map((s, i) => (
              <div key={s} className={"step" + (i < idx ? " done" : i === idx ? " now" : "")}>
                <i>{i < idx ? "✓" : i + 1}</i>
                <span>{tr.steps[s]}</span>
              </div>
            ))
          )}
        </div>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="ord-label mb-2">{tr.items}</div>
            {order.items.map((it) => (
              <div key={it.id} className="line">
                <div>
                  <div className="text-sm font-bold">
                    {it.qty} × {it.name}
                  </div>
                  {it.note ? <div className="text-xs text-dim">{it.note}</div> : null}
                </div>
                <span className="font-mono text-sm">{formatPrice(it.price * it.qty)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between font-mono text-base font-bold">
              <span>{t.order.total}</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <div className="ord-label mb-1">{tr.when}</div>
              {order.requested_at === "simdi" ? t.order.now : order.requested_at}
            </div>
            <div>
              <div className="ord-label mb-1">{tr.payment}</div>
              {order.payment === "cod" ? t.order.cod : t.order.cardOnDelivery}
            </div>
            <div>
              <div className="ord-label mb-1">{order.type === "pickup" ? t.order.pickup : t.order.delivery}</div>
              {order.type === "delivery" ? (
                <>
                  {getZone(order.zone)?.name}
                  <br />
                  {order.address}
                </>
              ) : (
                SITE.address
              )}
            </div>
            <div>
              <div className="ord-label mb-1">{t.order.name}</div>
              {order.name} · {order.phone}
            </div>
          </div>
        </section>

        <div className="mt-10 flex gap-3">
          <Link href="/siparis" className="addbtn">
            {tr.newOrder}
          </Link>
          <Link href="/" className="ord-label self-center hover:text-cream">
            mag.
          </Link>
        </div>
      </div>
    </main>
  );
}
