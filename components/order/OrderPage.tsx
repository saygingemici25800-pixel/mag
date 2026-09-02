"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { OPENS_AT_LABEL, isOpen, timeSlots } from "@/lib/hours";
import { computeTotals, normalizePhone, type OrderType } from "@/lib/orders-shared";
import type { NewOrderInput, ValidationError } from "@/lib/orders";
import { useClockMinute } from "@/lib/useClock";
import { ZONES, getZone } from "@/lib/zones";
import Cart, { type CheckoutForm } from "./Cart";
import MenuGrid, { type Cart as CartMap, type CartLine } from "./MenuGrid";
import MinCartInfo from "./MinCartInfo";
import "./order.css";

const t = getMessages("tr");
const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** /siparis — Gel-al | Kurye, mahalle + ⓘ, menü, sepet, bilgiler, teslimatta ödeme → POST /api/orders */
export default function OrderPage() {
  const router = useRouter();
  const o = t.order;
  const [mode, setMode] = useState<OrderType>("pickup");
  const [zone, setZone] = useState("");
  const [cart, setCart] = useState<CartMap>({});
  const [info, setInfo] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", address: "", requested_at: "simdi", note: "", payment: "cod" });
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const minute = useClockMinute();
  const open = minute < 0 ? null : isOpen();
  const slots = useMemo(() => (minute < 0 ? ["simdi"] : timeSlots()), [minute]);

  const items = useMemo(() => Object.entries(cart).map(([id, l]) => ({ id, qty: l.qty, note: l.note || undefined })), [cart]);
  const totals = useMemo(() => computeTotals(items, mode, zone), [items, mode, zone]);

  const onLine = useCallback((id: string, patch: Partial<CartLine> | null) => {
    setCart((c) => {
      const next = { ...c };
      if (!patch || (patch.qty !== undefined && patch.qty <= 0)) delete next[id];
      else next[id] = { qty: patch.qty ?? c[id]?.qty ?? 1, note: patch.note ?? c[id]?.note ?? "" };
      return next;
    });
  }, []);

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
      items,
      name: form.name,
      phone: form.phone,
      address: mode === "delivery" ? form.address : null,
      requested_at: slots.includes(form.requested_at) ? form.requested_at : "simdi",
      note: form.note,
      payment: form.payment,
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 201 && data.id) {
        router.push(`/siparis/${data.id}`);
        return;
      }
      setErrors(Array.isArray(data.errors) && data.errors.length ? data.errors : [{ field: "generic", code: "failed" }]);
    } catch {
      setErrors([{ field: "generic", code: "network" }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="ord">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5">
          <div className="ord-label">
            {open === false ? fmt(o.closedShort, { open: OPENS_AT_LABEL }) : fmt(o.hours, { open: OPENS_AT_LABEL })}
          </div>
          <h1 className="big in">
            <span>
              <i>{o.title[0]}</i>
            </span>
            <span>
              <i>{o.title[1]}</i>
            </span>
          </h1>
          <p className="max-w-md text-dim">{o.lead}</p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="seg" role="group" aria-label={`${o.pickup} / ${o.delivery}`}>
              <button type="button" aria-pressed={mode === "pickup"} onClick={() => setMode("pickup")}>
                {o.pickup}
              </button>
              <button type="button" aria-pressed={mode === "delivery"} onClick={() => setMode("delivery")}>
                {o.delivery}
              </button>
            </div>
            {mode === "delivery" ? (
              <div className="flex items-center gap-2">
                <select className="ctl" style={{ width: "auto", minWidth: 200 }} value={zone} onChange={(e) => setZone(e.target.value)} aria-label={o.zoneLabel}>
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
            ) : null}
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <MenuGrid t={o} cart={cart} onChange={onLine} />
          <Cart
            t={o}
            mode={mode}
            zoneName={getZone(zone)?.name ?? null}
            cart={cart}
            totals={totals}
            slots={slots}
            open={open}
            form={form}
            errors={errors}
            submitting={submitting}
            opensAt={OPENS_AT_LABEL}
            onForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onChange={(id, qty) => onLine(id, qty <= 0 ? null : { qty })}
            onSubmit={submit}
          />
        </div>
      </div>
      {info ? <MinCartInfo t={o} onClose={() => setInfo(false)} /> : null}
    </main>
  );
}
