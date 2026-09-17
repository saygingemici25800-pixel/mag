"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { cartCount, useCart } from "@/lib/cart";
import { computeTotals } from "@/lib/orders-shared";
import { formatPriceFor, localePath, priceParts } from "@/lib/i18n";
import { useSettings } from "@/lib/useSettings";

/** Yapışkan sepet çubuğu: sepet doluyken altta fixed; belirirken yükselir, adet değişince rozet zıplar. */
export default function CartBar() {
  const t = useT();
  const locale = useLocale();
  const cart = useCart();
  const count = cartCount(cart);
  /* Fiyatlar panelden değişebiliyor: settings.prices toplamı etkiler. */
  const settings = useSettings();
  const totals = computeTotals(Object.entries(cart).map(([id, l]) => ({ id, qty: l.qty })), "pickup", null, null, settings.prices);
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (count !== prev.current && count > 0) setBump((b) => b + 1);
    prev.current = count;
  }, [count]);
  if (count === 0) return null;
  return (
    <div className="cartbarwrap" data-cartbar>
      <Link href={localePath(locale, "/siparis/odeme")} className="cartbar2" prefetch={false}>
        <span className="cb-icon" data-cart-icon aria-hidden="true">
          🛒
          <b key={bump} className="cb-badge" data-cart-badge>
            {count}
          </b>
        </span>
        <span className="cb-total">
          <small>
            {count} {t.order.itemsCount}
          </small>
          {/* cartFx tutarı sayı geçişiyle günceller: ham değer data-value'da, önek data-prefix'te */}
          <span data-cart-total data-value={totals.subtotal} {...priceParts(locale)}>
            {formatPriceFor(locale, totals.subtotal)}
          </span>
        </span>
        <span className="cb-go">{t.order.goCart} →</span>
      </Link>
    </div>
  );
}
