"use client";

import { useState } from "react";

/** Hazırlanma süresi varsayılanı (dakika) */
const DEFAULT_PREP = 30;
import type { Messages } from "@/lib/i18n";
import { formatPrice } from "@/lib/menu";
import { closeLabelKey, panelStage, shortId, stageAdvance, type Order, type OrderStatus } from "@/lib/orders";
import { getZone } from "@/lib/zones";

interface Props {
  t: Messages["panel"];
  order: Order;
  unseen: boolean;
  fresh: boolean;
  busy: boolean;
  onSeen: () => void;
  onStatus: (status: OrderStatus, reason?: string, prepMinutes?: number) => void;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

/**
 * Sipariş kartı — panelde ÜÇ AŞAMA:
 *   YENİ   → "Siparişi al" + hazırlanma süresi (dk, varsayılan 30) → HAZIR
 *   HAZIR  → kurye ise "Yola çıktı", gel-al ise "Teslim edildi"    → KAPANDI
 *   İptal her aşamada, sebep sorulmadan ama ONAY ile.
 * Zaman damgaları sunucuda yazılır; kartta "19:42'de alındı · 35 dk" görünür.
 */
export default function OrderCard({ t, order: o, unseen, fresh, busy, onSeen, onStatus }: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [prep, setPrep] = useState(String(DEFAULT_PREP));
  const stage = panelStage(o);
  const next = stageAdvance(o);
  const done = stage === "closed" || stage === "cancelled";
  const mapQ = encodeURIComponent(`${o.address ?? ""} ${getZone(o.zone)?.name ?? ""} Fethiye`);

  return (
    <article
      className={"ocard" + (unseen ? " unseen" : "") + (fresh ? " fresh" : "") + (done ? " done" : "")}
      data-id={o.id}
    >
      <div className="ohead">
        <span className="oid">
          #{shortId(o.id)} · {timeOf(o.created_at)}
        </span>
        <span className="flex flex-wrap gap-2">
          <span className="badge2 type">{o.type === "pickup" ? t.pickup : t.delivery}</span>
          <span className="badge2">{t.paid}</span>
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
            <span className="font-display text-sm text-dim">{formatPrice(it.price * it.qty)}</span>
            {/* Mutfak bunu kaçırmamalı: küçük punto ama yüksek kontrast (limon) */}
            {it.removed?.length ? (
              <small className="oremoved" data-removed>
                {t.removedLabel}: {it.removed.join(", ")}
              </small>
            ) : null}
            {it.note ? <small>↳ {it.note}</small> : null}
          </div>
        ))}
        {o.note ? (
          <div>
            <b>!</b>
            <span className="text-cream">
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
        <p className="m-0 text-sm text-cream">
          {t.cancelReason}: {o.cancel_reason}
        </p>
      ) : null}

      {/* aşama zaman damgaları: "19:42'de alındı · 35 dk" */}
      {o.accepted_at ? (
        <p className="ostamp">
          {timeOf(o.accepted_at)} {t.acceptedAt}
          {typeof o.prep_minutes === "number" ? ` · ${o.prep_minutes} ${t.min}` : ""}
          {o.closed_at ? ` · ${timeOf(o.closed_at)} ${t.closedAt}` : ""}
        </p>
      ) : null}
      {o.cancelled_at ? (
        <p className="ostamp">
          {timeOf(o.cancelled_at)} {t.cancelledAt}
        </p>
      ) : null}

      {!done ? (
        <div className="oacts">
          {stage === "new" && next ? (
            <>
              <label className="prepbox">
                <span>{t.prepLabel}</span>
                <input type="number" min={1} max={240} inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} aria-label={t.prepLabel} data-prep />
                <b>{t.min}</b>
              </label>
              <button type="button" className="act primary" disabled={busy} data-accept onClick={() => onStatus(next, undefined, Number(prep) || DEFAULT_PREP)}>
                → {t.accept}
              </button>
            </>
          ) : null}
          {stage === "ready" && next ? (
            <button type="button" className="act primary" disabled={busy} data-close onClick={() => onStatus(next)}>
              → {t.close[closeLabelKey(o.type)]}
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
          {/* sebep sorulmaz, yalnızca onay */}
          <span className="text-sm">{t.cancelSure}</span>
          <button
            type="button"
            className="act danger"
            disabled={busy}
            data-cancel-confirm
            onClick={() => {
              onStatus("cancelled");
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
