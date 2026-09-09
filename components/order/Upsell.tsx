"use client";

import { useLocale, useT } from "@/components/LocaleProvider";
import { cartAdd, cartSet, qtyOf, useCart } from "@/lib/cart";
import { flyToCart } from "@/lib/cartFx";
import { formatPriceFor, itemName } from "@/lib/i18n";
import { upsellItems } from "@/lib/menu";
import ProductImage from "./ProductImage";
import { useSettings } from "@/lib/useSettings";

/**
 * "YANINDA İYİ GİDER" — sepet özetinin altında içecek / yan ürün / sos önerileri.
 * Sepette olan ürün "+ Ekle" yerine adet kontrolü (− n +) gösterir; ekleme mevcut cartFx
 * uçuş animasyonunu tetikler (sepet çubuğu ve toplam useCart aboneliğiyle anında güncellenir).
 * Boş sepette hiç render edilmez (çağıran taraf da kontrol eder, burada da güvence var).
 */
export default function Upsell() {
  const t = useT();
  const locale = useLocale();
  const o = t.order;
  const cart = useCart();
  const settings = useSettings();
  const items = upsellItems();
  if (Object.keys(cart).length === 0) return null;

  const add = (id: string, card: HTMLElement | null) => {
    const commit = () => cartAdd(id, 1);
    const source = card?.querySelector<HTMLElement>(".pimg");
    if (source) void flyToCart({ source, commit });
    else commit();
  };

  return (
    <section className="upsell" aria-labelledby="upsell-title" data-upsell>
      <h2 className="upsell-h" id="upsell-title">
        {o.upsellTitle}
      </h2>
      <ul className="upsell-list">
        {items.map((m) => {
          const qty = qtyOf(cart, m.id);
          const name = itemName(t, m);
          const out = settings.sold_out.includes(m.id);
          return (
            <li key={m.id} className={"upsell-card" + (out ? " soldout" : "")} data-upsell-item={m.id} data-sold-out={out || undefined}>
              <ProductImage m={m} name={name} size={72} />
              <div className="upsell-name">{name}</div>
              <div className="upsell-price">{formatPriceFor(locale, m.price)}</div>
              {qty > 0 ? (
                <span className="qty" data-upsell-qty>
                  <button type="button" aria-label={`${name} ${o.less}`} onClick={() => cartSet(m.id, qty - 1)}>
                    −
                  </button>
                  <b>{qty}</b>
                  <button type="button" aria-label={`${name} ${o.more}`} onClick={() => cartSet(m.id, qty + 1)}>
                    +
                  </button>
                </span>
              ) : (
                <button type="button" className="addbtn upsell-add" data-upsell-add disabled={out} onClick={(e) => { if (!out) add(m.id, e.currentTarget.closest<HTMLElement>(".upsell-card")); }}>
                  {out ? o.soldOut : o.add}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
