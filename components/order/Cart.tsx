"use client";

import { useState } from "react";
import { itemName, type Messages } from "@/lib/i18n";
import { findMenuItem, formatPrice, type OrderType, type Payment } from "@/lib/orders-shared";
import type { Totals, ValidationError } from "@/lib/orders";
import type { Cart as CartMap } from "./MenuGrid";

export interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  requested_at: string;
  note: string;
  payment: Payment;
}

interface Props {
  t: Messages;
  mode: OrderType;
  zoneName: string | null;
  cart: CartMap;
  totals: Totals;
  slots: string[];
  open: boolean | null;
  form: CheckoutForm;
  errors: ValidationError[];
  submitting: boolean;
  onForm: (patch: Partial<CheckoutForm>) => void;
  onChange: (id: string, qty: number) => void;
  onSubmit: () => void;
  opensAt: string;
}

const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** Sepet + bilgiler + ödeme. ≥1024px sağda yapışık panel, altında alttan çekmece. */
export default function Cart(p: Props) {
  const { cart, totals } = p;
  const t = p.t.order;
  const [drawer, setDrawer] = useState(false);
  const ids = Object.keys(cart);
  const count = ids.reduce((s, id) => s + cart[id].qty, 0);
  const err = (f: string) => p.errors.find((e) => e.field === f);
  const canSubmit = p.open === true && count > 0 && totals.missing === 0 && !p.submitting;

  return (
    <div className={"cartwrap" + (drawer ? " open" : "")}>
      <div className="cartpane">
        <button type="button" className="cartbar" onClick={() => setDrawer((v) => !v)} aria-expanded={drawer} title={drawer ? t.closeCart : t.openCart}>
          <span className="ord-h" style={{ fontSize: "1.2rem" }}>
            {t.cart} {count ? `(${count})` : ""}
          </span>
          <span className="font-mono text-sm">{formatPrice(totals.total)}</span>
        </button>
        <h2 className="ord-h hidden lg:block" style={{ fontSize: "1.4rem" }}>
          {t.cart}
        </h2>

        {ids.length === 0 ? (
          <p className="text-sm text-dim">{t.cartEmpty}</p>
        ) : (
          <div>
            {ids.map((id) => {
              const m = findMenuItem(id);
              if (!m) return null;
              const l = cart[id];
              return (
                <div key={id} className="line">
                  <div>
                    <div className="text-sm font-bold">{itemName(p.t, m)}</div>
                    {l.note ? <div className="text-xs text-dim">{l.note}</div> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="qty">
                      <button type="button" aria-label="Azalt" onClick={() => p.onChange(id, l.qty - 1)}>
                        −
                      </button>
                      <b>{l.qty}</b>
                      <button type="button" aria-label="Artır" onClick={() => p.onChange(id, l.qty + 1)}>
                        +
                      </button>
                    </span>
                    <span className="min-w-14 text-right font-mono text-sm">{formatPrice(m.price * l.qty)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-1 font-mono text-sm">
          <div className="flex justify-between text-dim">
            <span>{t.subtotal}</span>
            <span>{formatPrice(totals.subtotal)}</span>
          </div>
          {p.mode === "delivery" ? (
            <div className="flex justify-between text-dim">
              <span>
                {t.fee}
                {p.zoneName ? ` · ${p.zoneName}` : ""}
              </span>
              <span>{totals.fee ? formatPrice(totals.fee) : "—"}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <span>{t.total}</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
        </div>

        {p.mode === "delivery" && totals.minCart > 0 && totals.missing > 0 ? (
          <div className="warn">{fmt(t.minWarn, { min: totals.minCart, missing: totals.missing })}</div>
        ) : null}

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSubmit();
          }}
        >
          <div className="ord-label">{t.info}</div>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t.name}</span>
            <input className={"ctl" + (err("name") ? " ctl-err" : "")} placeholder={t.name} autoComplete="name" value={p.form.name} onChange={(e) => p.onForm({ name: e.target.value })} />
            {err("name") ? <span className="err">{t.err.name}</span> : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t.phone}</span>
            <input
              className={"ctl" + (err("phone") ? " ctl-err" : "")}
              placeholder={t.phonePlaceholder}
              inputMode="tel"
              autoComplete="tel"
              value={p.form.phone}
              onChange={(e) => p.onForm({ phone: e.target.value })}
            />
            {err("phone") ? <span className="err">{t.err.phone}</span> : null}
          </label>
          {p.mode === "delivery" ? (
            <label className="flex flex-col gap-1">
              <span className="sr-only">{t.address}</span>
              <textarea
                className={"ctl" + (err("address") ? " ctl-err" : "")}
                rows={3}
                placeholder={t.addressPlaceholder}
                autoComplete="street-address"
                value={p.form.address}
                onChange={(e) => p.onForm({ address: e.target.value })}
              />
              {err("address") ? <span className="err">{t.err.address}</span> : null}
              {err("zone") ? <span className="err">{t.err.zone}</span> : null}
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="ord-label">{t.when}</span>
            <select className={"ctl" + (err("requested_at") ? " ctl-err" : "")} value={p.form.requested_at} onChange={(e) => p.onForm({ requested_at: e.target.value })}>
              {p.slots.map((s) => (
                <option key={s} value={s}>
                  {s === "simdi" ? t.now : s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t.orderNote}</span>
            <input className="ctl" placeholder={t.orderNote} maxLength={200} value={p.form.note} onChange={(e) => p.onForm({ note: e.target.value })} />
          </label>

          <div className="ord-label mt-1">{t.payment}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["cod", "card_on_delivery"] as Payment[]).map((v) => (
              <label key={v} className="radio">
                <input type="radio" name="payment" value={v} checked={p.form.payment === v} onChange={() => p.onForm({ payment: v })} />
                <span>{v === "cod" ? t.cod : t.cardOnDelivery}</span>
              </label>
            ))}
          </div>

          {p.open === false ? <div className="warn">{fmt(t.closed, { open: p.opensAt })}</div> : null}
          {err("items") && count > 0 && totals.missing === 0 ? <span className="err">{t.err.items}</span> : null}
          {err("hours") ? <span className="err">{t.err.hours}</span> : null}
          {err("generic") ? <span className="err">{t.err.generic}</span> : null}

          <button type="submit" className="submit" disabled={!canSubmit}>
            {p.submitting ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
