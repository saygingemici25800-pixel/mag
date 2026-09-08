"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { cartClear, cartRemove, cartSet, cartSetRemoved, lineProductId, useCart } from "@/lib/cart";
import { animateLineOut, animateSummaryIn, prefetchCartFx } from "@/lib/cartFx";
import { OPENS_AT_LABEL, isOpen, timeSlots } from "@/lib/hours";
import { itemName, localePath } from "@/lib/i18n";
import type { NewOrderInput, ValidationError } from "@/lib/orders";
import { computeTotals, findMenuItem, formatPrice, normalizePhone, type OrderType } from "@/lib/orders-shared";
import { useClockMinute } from "@/lib/useClock";
import { ZONES, getZone } from "@/lib/zones";
import MinCartInfo from "./MinCartInfo";
import Upsell from "./Upsell";
import IngredientPicker from "./IngredientPicker";
import { useSettings } from "@/lib/useSettings";
import "./order.css";

const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** /siparis/odeme — 1) sepet özeti 2) gel-al|kurye (+mahalle ⓘ adres) 3) bilgiler 4) Ödemeye geç (yalnızca online) */
export default function CheckoutPage() {
  const t = useT();
  const o = t.order;
  const locale = useLocale();
  const cart = useCart();
  const [mode, setMode] = useState<OrderType>("pickup");
  const [zone, setZone] = useState("");
  const [info, setInfo] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", requested_at: "simdi", note: "" });
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /* malzeme paneli açık olan satır (kimlik) */
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  /* panel ayarları: sipariş kapalıysa ya da sepette tükenen ürün varsa ödeme yapılamaz */
  const settings = useSettings();
  const minute = useClockMinute();
  const open = minute < 0 ? null : isOpen();
  const slots = useMemo(() => (minute < 0 ? ["simdi"] : timeSlots()), [minute]);

  /* key = satır kimliği (ürün + çıkarılanlar); id = menü araması için ürün kimliği */
  const items = useMemo(
    () => Object.entries(cart).map(([key, l]) => ({ key, id: lineProductId(key), qty: l.qty, note: l.note || undefined, removed: l.removed ?? [] })),
    [cart],
  );
  /* sepet özeti girişi (Codrops cart drawer): bir kez, ilk çizimde */
  /* `summary` hem mobil hem masaüstü sütununda render ediliyor; görünür olan(lar)ı canlandır */
  useEffect(() => {
    prefetchCartFx();
    for (const el of document.querySelectorAll<HTMLElement>(".cartpane2")) void animateSummaryIn(el);
  }, []);

  /* satır silme: önce kaydırıp söndür, sonra veriden çıkar */
  const removeLine = (id: string, el: HTMLElement | null) => {
    if (!el) return cartRemove(id);
    void animateLineOut(el).then(() => cartRemove(id));
  };
  const totals = computeTotals(items, mode, zone);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const err = (f: string) => errors.find((e) => e.field === f);
  const soldOutInCart = items.filter((it) => settings.sold_out.includes(it.id)).map((it) => findMenuItem(it.id)?.name ?? it.id);
  const canSubmit = open === true && settings.ordering_open && soldOutInCart.length === 0 && count > 0 && totals.missing === 0 && !submitting;

  const submit = async () => {
    const errs: ValidationError[] = [];
    if (form.name.trim().length < 2) errs.push({ field: "name", code: "required" });
    if (!normalizePhone(form.phone)) errs.push({ field: "phone", code: "invalid" });
    if (mode === "delivery" && !getZone(zone)) errs.push({ field: "zone", code: "required" });
    if (mode === "delivery" && form.address.trim().length < 8) errs.push({ field: "address", code: "required" });
    setErrors(errs);
    if (errs.length) return;
    const body: NewOrderInput = {
      type: mode,
      zone: mode === "delivery" ? zone : null,
      /* Sunucuya yalnızca sözleşmedeki alanlar: satır kimliği (key) istemci detayı, gitmez. */
      items: items.map((it) => ({ id: it.id, qty: it.qty, ...(it.note ? { note: it.note } : {}), ...(it.removed.length ? { removed: it.removed } : {}) })),
      name: form.name,
      phone: form.phone,
      address: mode === "delivery" ? form.address : null,
      requested_at: slots.includes(form.requested_at) ? form.requested_at : "simdi",
      note: form.note,
      locale,
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 201 && data.redirectUrl) {
        cartClear();
        window.location.assign(data.redirectUrl);
        return;
      }
      setErrors(Array.isArray(data.errors) && data.errors.length ? data.errors : [{ field: "generic", code: "failed" }]);
    } catch {
      setErrors([{ field: "generic", code: "network" }]);
    } finally {
      setSubmitting(false);
    }
  };

  const summary = (
    <section className="cartpane2">
      <h2 className="ord-h" style={{ fontSize: "1.3rem" }}>
        {o.summary}
      </h2>
      {items.length === 0 ? (
        <p className="text-dim">
          {o.cartEmpty}{" "}
          <Link href={localePath(locale, "/siparis")} className="underline">
            {o.emptyGo}
          </Link>
        </p>
      ) : (
        <div>
          {items.map((it) => {
            const m = findMenuItem(it.id);
            if (!m) return null;
            return (
              <div key={it.key} className="line" data-cart-line data-line-key={it.key}>
                <div>
                  <div className="text-sm font-bold">{itemName(t, m)}</div>
                  {it.removed.length ? (
                    <p className="removed-line" data-removed>
                      {o.removedLabel}: {it.removed.join(", ")}
                    </p>
                  ) : null}
                  {it.note ? <div className="text-xs text-dim">{it.note}</div> : null}
                  {m.ingredients?.length ? (
                    <button type="button" className="ing-toggle" onClick={() => setPickerKey(pickerKey === it.key ? null : it.key)} aria-expanded={pickerKey === it.key} data-ing-open>
                      {it.removed.length ? o.editIngredients : o.removeIngredients}
                    </button>
                  ) : null}
                  <button type="button" className="ord-label mt-1 block cursor-pointer hover:text-cream" onClick={(e) => removeLine(it.key, e.currentTarget.closest<HTMLElement>("[data-cart-line]"))}>
                    {o.remove}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="qty">
                    <button type="button" aria-label="Azalt" onClick={() => cartSet(it.key, it.qty - 1)}>
                      −
                    </button>
                    <b>{it.qty}</b>
                    <button type="button" aria-label="Artır" onClick={() => cartSet(it.key, it.qty + 1)}>
                      +
                    </button>
                  </span>
                  <span className="min-w-14 text-right font-display text-sm">{formatPrice(m.price * it.qty)}</span>
                </div>
                {pickerKey === it.key ? (
                  <div className="w-full">
                    <IngredientPicker item={m} removed={it.removed} onChange={(next) => cartSetRemoved(it.key, next)} onClose={() => setPickerKey(null)} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-1 font-display text-sm" data-cart-totals>
        <div className="flex justify-between text-dim">
          <span>{o.subtotal}</span>
          <span>{formatPrice(totals.subtotal)}</span>
        </div>
        {mode === "delivery" ? (
          <div className="flex justify-between text-dim">
            <span>
              {o.fee}
              {getZone(zone) ? ` · ${getZone(zone)!.name}` : ""}
            </span>
            <span>{totals.fee ? formatPrice(totals.fee) : "—"}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-base font-bold">
          <span>{o.total}</span>
          <span>{formatPrice(totals.total)}</span>
        </div>
      </div>
      {mode === "delivery" && totals.minCart > 0 && totals.missing > 0 ? <div className="warn">{fmt(o.minWarn, { min: totals.minCart, missing: totals.missing })}</div> : null}
    </section>
  );

  /* "YANINDA İYİ GİDER" — özet kartının altında; boş sepette görünmez */
  const upsell = items.length > 0 ? <Upsell /> : null;

  return (
    <main className="ord">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-3">
          <Link href={localePath(locale, "/siparis")} className="ord-label hover:text-cream">
            ← {o.backToMenu}
          </Link>
          <h1 className="big in">
            <span>
              <i>{o.checkoutTitle[0]}</i>
            </span>
          </h1>
          <p className="max-w-md text-dim">{o.onlineOnly}</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <form
            className="flex flex-col gap-8"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="lg:hidden">
              {summary}
              {upsell}
            </div>

            <section className="flex flex-col gap-4">
              <h2 className="ord-h" style={{ fontSize: "1.3rem" }}>
                {o.deliveryInfo}
              </h2>
              <div className="seg" role="group" aria-label={`${o.pickup} / ${o.delivery}`}>
                <button type="button" aria-pressed={mode === "pickup"} onClick={() => setMode("pickup")}>
                  {o.pickup}
                </button>
                <button type="button" aria-pressed={mode === "delivery"} onClick={() => setMode("delivery")}>
                  {o.delivery}
                </button>
              </div>
              {mode === "delivery" ? (
                <>
                  <div className="flex items-center gap-2">
                    <select className={"ctl" + (err("zone") ? " ctl-err" : "")} value={zone} onChange={(e) => setZone(e.target.value)} aria-label={o.zoneLabel}>
                      <option value="">{o.zonePlaceholder}</option>
                      {ZONES.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} · min {z.minCart} ₺
                        </option>
                      ))}
                    </select>
                    <button type="button" className="ibtn" aria-label={o.minInfoAria} onClick={() => setInfo(true)}>
                      i
                    </button>
                  </div>
                  {err("zone") ? <span className="err">{o.err.zone}</span> : null}
                  <textarea
                    className={"ctl" + (err("address") ? " ctl-err" : "")}
                    rows={3}
                    placeholder={o.addressPlaceholder}
                    autoComplete="street-address"
                    aria-label={o.address}
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                  {err("address") ? <span className="err">{o.err.address}</span> : null}
                </>
              ) : null}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="ord-h" style={{ fontSize: "1.3rem" }}>
                {o.info}
              </h2>
              <input className={"ctl" + (err("name") ? " ctl-err" : "")} placeholder={o.name} aria-label={o.name} autoComplete="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              {err("name") ? <span className="err">{o.err.name}</span> : null}
              <input
                className={"ctl" + (err("phone") ? " ctl-err" : "")}
                placeholder={o.phonePlaceholder}
                aria-label={o.phone}
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              {err("phone") ? <span className="err">{o.err.phone}</span> : null}
              <label className="flex flex-col gap-1">
                <span className="ord-label">{o.when}</span>
                <select className="ctl" value={form.requested_at} onChange={(e) => setForm((f) => ({ ...f, requested_at: e.target.value }))}>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {s === "simdi" ? o.now : s}
                    </option>
                  ))}
                </select>
              </label>
              <input className="ctl" placeholder={o.orderNote} aria-label={o.orderNote} maxLength={200} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </section>

            {open === false ? <div className="warn">{fmt(o.closed, { open: OPENS_AT_LABEL })}</div> : null}
            {err("hours") ? <span className="err">{o.err.hours}</span> : null}
            {err("payment") || err("generic") ? <span className="err">{o.err.generic}</span> : null}
            {!settings.ordering_open ? (
              <div className="warn" data-closed>
                <b>{o.closedTitle}</b> — {o.closedLead}
              </div>
            ) : null}
            {soldOutInCart.length > 0 ? (
              <div className="warn" data-soldout-warn>
                {fmt(o.soldOutWarn, { items: soldOutInCart.join(", ") })}
              </div>
            ) : null}
            <button type="submit" className="submit" disabled={!canSubmit}>
              {submitting ? o.payingNow : `${o.payNow} · ${formatPrice(totals.total)}`}
            </button>
          </form>
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              {summary}
              {upsell}
            </div>
          </aside>
        </div>
      </div>
      {info ? <MinCartInfo t={o} onClose={() => setInfo(false)} /> : null}
    </main>
  );
}
