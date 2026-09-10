"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { formatPriceFor, localePath } from "@/lib/i18n";
import { STATUS_FLOW, shortId, type Order } from "@/lib/orders";

import { getZone } from "@/lib/zones";
import { SITE } from "@/lib/site";
import "./order.css";

const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** /siparis/[id] — durum: alındı → hazırlanıyor → hazır/yolda → teslim. Canlı (SSE). */
export default function OrderTrack({ initial }: { initial: Order }) {
  const t = useT();
  const locale = useLocale();
  const [order, setOrder] = useState(initial);
  const [live, setLive] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const tr = t.track;
  const retry = async () => {
    setRetrying(true);
    try {
      const res = await fetch("/api/payments/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: order.id }) });
      const data = await res.json();
      if (res.ok && data.redirectUrl) window.location.assign(data.redirectUrl);
    } finally {
      setRetrying(false);
    }
  };

  /* Canlı durum: yoklama. SSE kaldırıldı — Vercel (Hobby) akışı ~0.7 sn içinde sonlandırıyor,
     bağlantı hiç ayakta kalmıyordu. Müşteri ekranı 6 sn'de bir kendi siparişini sorar; sekme arka
     plandayken 30 sn. Sipariş kapandığında (teslim/iptal) yoklama durur. */
  useEffect(() => {
    if (order.status === "delivered" || order.status === "cancelled") return;
    if (order.payment_status !== "paid" && order.payment_status !== "awaiting_payment") return;
    let timer = 0;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const r = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (r.ok) {
          setOrder((await r.json()) as Order);
          setLive(true);
        } else setLive(false);
      } catch {
        setLive(false);
      } finally {
        if (!stopped) timer = window.setTimeout(tick, document.visibilityState === "visible" ? 6_000 : 30_000);
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      window.clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    timer = window.setTimeout(tick, 6_000);
    /* ilk "canlı" işareti bir kare sonra (efekt gövdesinde senkron setState uyarısı) */
    const raf = requestAnimationFrame(() => setLive(true));
    return () => {
      cancelAnimationFrame(raf);
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [order.id, order.status, order.payment_status]);

  const flow = STATUS_FLOW[order.type];
  const idx = order.status === "cancelled" ? -1 : flow.indexOf(order.status);

  return (
    <main className="ord">
      <div className="mx-auto max-w-2xl">
        <div className="ord-label">
          {tr.id} · {shortId(order.id)}
          {live ? <span className="ml-3 text-accent">● {tr.live}</span> : null}
        </div>
        <h1 className="big in mt-4">
          <span>
            <i>{tr.title[0]}</i>
          </span>
          <span>
            <i>{order.status === "cancelled" ? tr.steps.cancelled.split(" ")[0] : tr.title[1]}</i>
          </span>
        </h1>
        <div className={"mt-5 flex flex-wrap items-center gap-3 " + (order.payment_status === "payment_failed" ? "text-cream" : order.payment_status === "paid" ? "text-accent" : "text-dim")} data-payment={order.payment_status}>
          <span className="badge2">
            {tr.paymentLabel}: {t.payment.status[order.payment_status]}
          </span>
          <span className="text-sm">
            {order.payment_status === "paid" ? t.payment.paidLead : order.payment_status === "payment_failed" ? t.payment.failedLead : t.payment.awaitingLead}
          </span>
          {order.payment_status !== "paid" ? (
            <button type="button" className="addbtn" onClick={retry} disabled={retrying}>
              {t.payment.retry}
            </button>
          ) : null}
        </div>
        <p className="mt-4 max-w-md text-dim">
          {order.type === "pickup" ? fmt(tr.pickupHint, { address: SITE.address }) : tr.deliveryHint}
        </p>

        <div className="steps mt-8">
          {order.status === "cancelled" ? (
            <div className="step now">
              <i>×</i>
              <span>
                {tr.steps.cancelled}
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
                <span className="font-bold text-sm">{formatPriceFor(locale, it.price * it.qty)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between font-bold text-base">
              <span>{t.order.total}</span>
              <span>{formatPriceFor(locale, order.total)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <div className="ord-label mb-1">{tr.when}</div>
              {order.requested_at === "simdi" ? t.order.now : order.requested_at}
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
          <Link href={localePath(locale, "/siparis")} className="addbtn">
            {tr.newOrder}
          </Link>
          <Link href={localePath(locale, "/")} className="ord-label self-center hover:text-cream">
            mag.
          </Link>
        </div>
      </div>
    </main>
  );
}
