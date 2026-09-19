"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { cartClear, cartRemove, cartSet, cartSetRemoved, lineProductId, useCart } from "@/lib/cart";
import { animateLineOut, animateSummaryIn, prefetchCartFx } from "@/lib/cartFx";
import { isOpen, timeSlots } from "@/lib/hours";
import { closedLabel } from "@/lib/hoursLabel";
import { formatPriceFor, ingName, itemName, localePath } from "@/lib/i18n";
import type { NewOrderInput, ValidationError } from "@/lib/orders";
import { computeTotals, findMenuItem, normalizePhone, type OrderType } from "@/lib/orders-shared";
import { useClockMinute } from "@/lib/useClock";
import { findZone, zoneActive } from "@/lib/zones";
import ProductImage from "./ProductImage";
import MinCartInfo from "./MinCartInfo";
import Upsell from "./Upsell";
import IngredientList from "./IngredientList";
import { useSettings } from "@/lib/useSettings";
import { allClosed, deliveryOpen, pickupOpen, typeOpen } from "@/lib/settings";
import "./order.css";
import { priceOf } from "@/lib/menu";

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
  /* Bölgeler PANELDEN: settings.zones. Veritabanı boşsa normalizeSettings
     koddaki varsayılana düşürüyor, yani liste hiçbir zaman boş kalmıyor. */
  /* Servis şalterleri: kurye ve gel-al bağımsız kapanabilir (ana şalter ikisini de kapatır) */
  const dOpen = deliveryOpen(settings);
  const pOpen = pickupOpen(settings);
  const hepsiKapali = allClosed(settings);
  /* Yalnız bir tür açıksa kullanıcı seçim yapmak zorunda kalmasın: SEÇİLİ tür
     hesapla, state'i effect içinde değiştirme (cascading render uyarısı).
     `mode` kullanıcının tercihi; `etkinMode` ekranda ve gönderimde geçerli olan.
     Kapalı türde kalınmışsa açık olana kayar. */
  const etkinMode: OrderType = hepsiKapali
    ? mode
    : mode === "delivery" && !dOpen && pOpen
      ? "pickup"
      : mode === "pickup" && !pOpen && dOpen
        ? "delivery"
        : mode;
  const zones = settings.zones;
  const selected = findZone(zones, zone);
  const totals = computeTotals(items, etkinMode, zone, zones, settings.prices);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const err = (f: string) => errors.find((e) => e.field === f);
  const soldOutInCart = items.filter((it) => settings.sold_out.includes(it.id)).map((it) => findMenuItem(it.id)?.name ?? it.id);
  const canSubmit = open === true && settings.ordering_open && typeOpen(settings, etkinMode) && soldOutInCart.length === 0 && count > 0 && totals.missing === 0 && !submitting;

  const submit = async () => {
    const errs: ValidationError[] = [];
    if (form.name.trim().length < 2) errs.push({ field: "name", code: "required" });
    if (!normalizePhone(form.phone)) errs.push({ field: "phone", code: "invalid" });
    if (etkinMode === "delivery" && !zoneActive(findZone(zones, zone))) errs.push({ field: "zone", code: "required" });
    if (etkinMode === "delivery" && form.address.trim().length < 8) errs.push({ field: "address", code: "required" });
    setErrors(errs);
    if (errs.length) return;
    const body: NewOrderInput = {
      type: etkinMode,
      zone: etkinMode === "delivery" ? zone : null,
      /* Sunucuya yalnızca sözleşmedeki alanlar: satır kimliği (key) istemci detayı, gitmez. */
      items: items.map((it) => ({ id: it.id, qty: it.qty, ...(it.note ? { note: it.note } : {}), ...(it.removed.length ? { removed: it.removed } : {}) })),
      name: form.name,
      phone: form.phone,
      address: etkinMode === "delivery" ? form.address : null,
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
                {/* 13 Eyl 2026: sepet/ödeme özetinde görsel YOKTU (yalnızca metin).
                    ProductImage aynı sırayı uygular: kesim > fotoğraf > kısa ad rozeti. */}
                <ProductImage m={m} name={itemName(t, m)} size={56} />
                <div>
                  <div className="text-sm font-bold">{itemName(t, m)}</div>
                  {it.removed.length ? (
                    <p className="removed-line" data-removed>
                      {o.removedLabel}: {it.removed.map((r) => ingName(t, r)).join(", ")}
                    </p>
                  ) : null}
                  {it.note ? <div className="text-xs text-dim">{it.note}</div> : null}
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
                  <span className="min-w-14 text-right font-bold text-sm">{formatPriceFor(locale, priceOf(m, settings.prices) * it.qty)}</span>
                </div>
                {/* Malzeme listesi HER ZAMAN AÇIK — satırın tam genişliğinde, ürün adıyla aynı hizada */}
                <IngredientList item={m} removed={it.removed} onChange={(next) => cartSetRemoved(it.key, next)} />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-1 font-bold text-sm" data-cart-totals>
        <div className="flex justify-between text-dim">
          <span>{o.subtotal}</span>
          <span>{formatPriceFor(locale, totals.subtotal)}</span>
        </div>
        {etkinMode === "delivery" ? (
          <div className="flex justify-between text-dim">
            <span>
              {o.fee}
              {selected ? ` · ${selected.name}` : ""}
            </span>
            <span>{totals.fee ? formatPriceFor(locale, totals.fee) : "—"}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-base font-bold">
          <span>{o.total}</span>
          <span>{formatPriceFor(locale, totals.total)}</span>
        </div>
      </div>
      {etkinMode === "delivery" && totals.minCart > 0 && totals.missing > 0 ? <div className="warn">{fmt(o.minWarn, { min: totals.minCart, missing: totals.missing })}</div> : null}
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
                <button
                  type="button"
                  aria-pressed={etkinMode === "pickup"}
                  disabled={!pOpen}
                  data-mode-pickup
                  data-mode-closed={!pOpen || undefined}
                  title={pOpen ? undefined : o.pickupClosedNote}
                  onClick={() => setMode("pickup")}
                >
                  {o.pickup}
                </button>
                <button
                  type="button"
                  aria-pressed={etkinMode === "delivery"}
                  disabled={!dOpen}
                  data-mode-delivery
                  data-mode-closed={!dOpen || undefined}
                  title={dOpen ? undefined : o.deliveryClosedNote}
                  onClick={() => setMode("delivery")}
                >
                  {o.delivery}
                </button>
              </div>
              {/* Kapalı türün SEBEBİ düğmenin altında yazıyla da görünsün (title yetmez) */}
              {!pOpen && !hepsiKapali ? <span className="svc-note" data-pickup-closed>{o.pickupClosedNote}</span> : null}
              {!dOpen && !hepsiKapali ? <span className="svc-note" data-delivery-closed>{o.deliveryClosedNote}</span> : null}
              {etkinMode === "delivery" ? (
                <>
                  <div className="flex items-center gap-2">
                    <select className={"ctl" + (err("zone") ? " ctl-err" : "")} value={zone} onChange={(e) => setZone(e.target.value)} aria-label={o.zoneLabel}>
                      <option value="">{o.zonePlaceholder}</option>
                      {zones.map((z) => {
                        const kapali = !zoneActive(z);
                        return (
                          /* Kapalı mahalle listede GÖRÜNÜR ama seçilemez: müşteri
                             "neden yok?" diye aramasın, durumu görsün. */
                          <option key={z.id} value={z.id} disabled={kapali} data-zone-opt={z.id} data-zone-closed={kapali || undefined}>
                            {z.name} · min {z.minCart} ₺{z.fee ? ` · +${z.fee} ₺` : ""}
                            {kapali ? ` · ${o.zoneClosedLabel}` : z.etaMinutes ? ` · ${o.zoneEtaLabel.replace("{min}", String(z.etaMinutes))}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button type="button" className="ibtn" aria-label={o.minInfoAria} onClick={() => setInfo(true)}>
                      i
                    </button>
                  </div>
                  {err("zone") ? <span className="err">{o.err.zone}</span> : null}
                  {/* Minimum sepet uyarısı: hangi mahalle, ne kadar gerekiyor, sepette ne var */}
                  {selected && totals.missing > 0 ? (
                    <span className="err" data-min-warn>
                      {o.minCartWarn.replace("{min}", String(totals.minCart)).replace("{have}", String(totals.subtotal))}
                    </span>
                  ) : null}
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

            {open === false ? (
              <div className="warn" data-hours-closed>
                {closedLabel(t)}
              </div>
            ) : null}
            {err("hours") ? <span className="err">{o.err.hours}</span> : null}
            {err("payment") || err("generic") ? <span className="err">{o.err.generic}</span> : null}
            {/* Mesaj sırası: SAAT kapalıysa onun mesajı yukarıda zaten var; servis
                mesajı yalnızca saat AÇIKKEN gösterilir ki iki uyarı çakışmasın. */}
            {open !== false && !settings.ordering_open ? (
              <div className="warn" data-closed>
                <b>{o.closedTitle}</b> — {o.closedLead}
              </div>
            ) : null}
            {open !== false && settings.ordering_open && hepsiKapali ? (
              <div className="warn" data-allclosed>
                <b>{o.allClosedTitle}</b>
              </div>
            ) : null}
            {soldOutInCart.length > 0 ? (
              <div className="warn" data-soldout-warn>
                {fmt(o.soldOutWarn, { items: soldOutInCart.join(", ") })}
              </div>
            ) : null}
            <button type="submit" className="submit" disabled={!canSubmit}>
              {submitting ? o.payingNow : `${o.payNow} · ${formatPriceFor(locale, totals.total)}`}
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
