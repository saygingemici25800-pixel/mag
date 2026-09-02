"use client";

import { useState } from "react";
import type { Messages } from "@/lib/i18n";
import { HERO_ITEMS, formatPrice } from "@/lib/menu";
import { nextStatus, shortId, type Order, type OrderStatus } from "@/lib/orders";
import { getZone } from "@/lib/zones";

interface Props {
  t: Messages["panel"];
  order: Order;
  unseen: boolean;
  fresh: boolean;
  busy: boolean;
  onSeen: () => void;
  onStatus: (status: OrderStatus, reason?: string) => void;
}

function accentOf(o: Order): string {
  for (const it of o.items) {
    const h = HERO_ITEMS.find((m) => m.id === it.id);
    if (h) return h.accent;
  }
  return "var(--kraft)";
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

/** Sipariş kartı: ürünler+adet+not, tel:, harita, istenen saat, rozetler, sıradaki durum, iptal + sebep. */
export default function OrderCard({ t, order: o, unseen, fresh, busy, onSeen, onStatus }: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const next = nextStatus(o);
  const done = o.status === "delivered" || o.status === "cancelled";
  const mapQ = encodeURIComponent(`${o.address ?? ""} ${getZone(o.zone)?.name ?? ""} Fethiye`);

  return (
    <article
      className={"ocard" + (unseen ? " unseen" : "") + (fresh ? " fresh" : "") + (done ? " done" : "")}
      style={{ "--acc": accentOf(o) } as React.CSSProperties}
      data-id={o.id}
    >
      <div className="ohead">
        <span className="oid">
          #{shortId(o.id)} · {timeOf(o.created_at)}
        </span>
        <span className="flex flex-wrap gap-2">
          <span className="badge2 type">{o.type === "pickup" ? t.pickup : t.delivery}</span>
          <span className="badge2">{o.payment === "cod" ? t.cod : o.payment === "card_on_delivery" ? t.cardOnDelivery : t.online}</span>
          <span className="badge2">{t.status[o.status]}</span>
          {unseen ? <span className="badge2 type">{t.new}</span> : null}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h3 className="oname">{o.name}</h3>
        <span className="total">{formatPrice(o.total)}</span>
      </div>

      <div className="oitems">
        {o.items.map((it, i) => (
          <div key={i}>
            <b>{it.qty}×</b>
            <span>{it.name}</span>
            <span className="font-mono text-sm text-dim">{formatPrice(it.price * it.qty)}</span>
            {it.note ? <small>↳ {it.note}</small> : null}
          </div>
        ))}
        {o.note ? (
          <div>
            <b>!</b>
            <span className="text-kraft">
              {t.note}: {o.note}
            </span>
          </div>
        ) : null}
      </div>

      <div className="ometa">
        <a href={`tel:${o.phone}`}>
          ☎ {t.call} · {o.phone}
        </a>
        {o.type === "delivery" && o.address ? (
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`} target="_blank" rel="noopener noreferrer">
            ⌖ {t.map} · {getZone(o.zone)?.name ?? o.zone}
          </a>
        ) : null}
        <span>
          ⏱ {t.when}: {o.requested_at === "simdi" ? t.now : o.requested_at}
        </span>
      </div>
      {o.type === "delivery" && o.address ? <p className="m-0 text-sm text-dim">{o.address}</p> : null}
      {o.status === "cancelled" && o.cancel_reason ? (
        <p className="m-0 text-sm text-ember">
          {t.cancelReason}: {o.cancel_reason}
        </p>
      ) : null}

      {!done ? (
        <div className="oacts">
          {next ? (
            <button type="button" className="act primary" disabled={busy} onClick={() => onStatus(next)}>
              → {t.next[next as keyof typeof t.next]}
            </button>
          ) : null}
          {unseen ? (
            <button type="button" className="act ghost" onClick={onSeen}>
              ✓ {t.seen}
            </button>
          ) : null}
          {!cancelOpen ? (
            <button type="button" className="act danger" disabled={busy} onClick={() => setCancelOpen(true)}>
              {t.cancel}
            </button>
          ) : null}
        </div>
      ) : null}
      {cancelOpen && !done ? (
        <div className="cancelbox">
          <input placeholder={t.cancelReason} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <button
            type="button"
            className="act danger"
            disabled={busy}
            onClick={() => {
              onStatus("cancelled", reason);
              setCancelOpen(false);
            }}
          >
            {t.cancelConfirm}
          </button>
          <button type="button" className="act ghost" onClick={() => setCancelOpen(false)}>
            {t.cancelBack}
          </button>
        </div>
      ) : null}
    </article>
  );
}
