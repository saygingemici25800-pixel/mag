"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { cartCount, useCart } from "@/lib/cart";
import { localePath } from "@/lib/i18n";
import { computeTotals, formatPrice } from "@/lib/orders-shared";

/** Yapışkan sepet çubuğu: sepet doluyken altta fixed; belirirken yükselir, adet değişince rozet zıplar. */
export default function CartBar() {
  const t = useT();
  const locale = useLocale();
  const cart = useCart();
  const count = cartCount(cart);
  const totals = computeTotals(Object.entries(cart).map(([id, l]) => ({ id, qty: l.qty })), "pickup");
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
        <span className="cb-icon" aria-hidden="true">
          🛒
          <b key={bump} className="cb-badge">
            {count}
          </b>
        </span>
        <span className="cb-total">
          <small>
            {count} {t.order.itemsCount}
          </small>
          {formatPrice(totals.subtotal)}
        </span>
        <span className="cb-go">{t.order.goCart} →</span>
      </Link>
    </div>
  );
}
