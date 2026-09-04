"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { cartAdd } from "@/lib/cart";
import { flyToCart } from "@/lib/cartFx";
import { itemDesc, itemName } from "@/lib/i18n";
import { formatPrice, type MenuItem } from "@/lib/menu";
import { findMenuItem } from "@/lib/orders-shared";
import Ingredients from "./Ingredients";
import ProductImage from "./ProductImage";

interface Props {
  item: MenuItem;
  onClose: () => void;
  onAdded: () => void;
}

/** Alttan gelen ürün sheet'i: büyük foto, tam içindekiler, adet, not, "Şununla iyi gider", Sepete ekle · ₺X */
export default function ProductSheet({ item, onClose, onAdded }: Props) {
  const t = useT();
  const o = t.order;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [addedPair, setAddedPair] = useState<Set<string>>(() => new Set());
  /* kopyaların çıkacağı büyük görsel */
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const pairs = (item.pairs ?? []).map(findMenuItem).filter((m): m is MenuItem => Boolean(m));
  const addPair = (m: MenuItem) => {
    const source = imgRef.current?.querySelector<HTMLElement>(".pimg");
    const commit = () => {
      cartAdd(m.id, 1);
      setAddedPair((s) => new Set(s).add(m.id));
      onAdded();
    };
    /* çipler de aynı fonksiyonu çağırır; sheet açık kalır */
    if (source) void flyToCart({ source, commit });
    else commit();
  };

  return (
    <div className="sheetwrap" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label={o.sheetClose}>
          ×
        </button>
        <div ref={imgRef}>
          <ProductImage m={item} name={itemName(t, item)} big />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sheet-title" className="tname" style={{ fontSize: "1.6rem" }}>
            {itemName(t, item)}
          </h2>
          <span className="price" style={{ fontSize: "1rem" }}>
            {formatPrice(item.price)}
          </span>
        </div>
        {itemDesc(t, item) ? (
          <div>
            <div className="ord-label mb-1">{o.ingredients}</div>
            <p className="m-0 text-cream/90">
              <Ingredients text={itemDesc(t, item)!} />
            </p>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="ord-label">{o.qty}</span>
          <span className="qty big">
            <button type="button" aria-label="Azalt" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <b>{qty}</b>
            <button type="button" aria-label="Artır" onClick={() => setQty((q) => Math.min(50, q + 1))}>
              +
            </button>
          </span>
        </div>
        <input className="ctl" placeholder={o.notePlaceholder} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} aria-label={o.noteToggle} />
        {pairs.length ? (
          <div>
            <div className="ord-label mb-2">{o.goodWith}</div>
            <div className="chips">
              {pairs.map((m) => (
                <button key={m.id} type="button" className={"chip" + (addedPair.has(m.id) ? " on" : "")} onClick={() => addPair(m)} aria-label={`${itemName(t, m)} ${formatPrice(m.price)} +`}>
                  <span>{itemName(t, m)}</span>
                  <small>{formatPrice(m.price)}</small>
                  <b>{addedPair.has(m.id) ? "✓" : "+"}</b>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="submit"
          onClick={() => {
            const source = imgRef.current?.querySelector<HTMLElement>(".pimg");
            const commit = () => {
              cartAdd(item.id, qty, note.trim() || undefined);
              onAdded();
            };
            /* sheet 150 ms sonra kapanır; kopyalar fixed olduğu için uçmaya devam eder */
            if (source) void flyToCart({ source, commit, closeSheet: onClose });
            else {
              commit();
              onClose();
            }
          }}
        >
          {o.addToCart} · {formatPrice(item.price * qty)}
        </button>
      </div>
    </div>
  );
}
