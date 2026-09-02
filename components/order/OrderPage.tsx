"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { OPENS_AT_LABEL, isOpen } from "@/lib/hours";
import { cartAdd, useCart } from "@/lib/cart";
import { itemDesc, itemName } from "@/lib/i18n";
import { MENU, formatPrice, type Category, type MenuItem } from "@/lib/menu";
import { useClockMinute } from "@/lib/useClock";
import CartBar from "./CartBar";
import ProductImage from "./ProductImage";
import ProductSheet from "./ProductSheet";
import "./order.css";

const ORDER: Category[] = ["burger", "taco", "noodle", "yan", "sos", "icecek"];
const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** /siparis — yapışkan kategori çipleri, büyük ürün kartları, ürün sheet'i, yapışkan sepet çubuğu (mobil öncelikli) */
export default function OrderPage() {
  const t = useT();
  const o = t.order;
  const cart = useCart();
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  const [activeCat, setActiveCat] = useState<Category>("burger");
  const minute = useClockMinute();
  const open = minute < 0 ? null : isOpen();
  const chipsRef = useRef<HTMLDivElement>(null);

  // görünür bölüme göre aktif çip
  useEffect(() => {
    const secs = ORDER.map((c) => document.getElementById(`kat-${c}`)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiveCat(vis.target.id.replace("kat-", "") as Category);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    chipsRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeCat]);

  const closeSheet = useCallback(() => setSheet(null), []);
  const noop = useCallback(() => {}, []);

  return (
    <main className="ord ord-list">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-col gap-4">
          <div className="ord-label">{open === false ? fmt(o.closedShort, { open: OPENS_AT_LABEL }) : fmt(o.hours, { open: OPENS_AT_LABEL })}</div>
          <h1 className="big in">
            <span>
              <i>{o.title[0]}</i>
            </span>
            <span>
              <i>{o.title[1]}</i>
            </span>
          </h1>
          <p className="max-w-md text-dim">{o.onlineOnly}</p>
        </header>

        <nav className="chipsbar" ref={chipsRef} aria-label={t.chrome.menu}>
          {ORDER.map((c) => (
            <a key={c} href={`#kat-${c}`} data-cat={c} className={"catchip" + (activeCat === c ? " on" : "")} onClick={() => setActiveCat(c)}>
              {t.categories[c]}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-10">
          {ORDER.map((cat) => (
            <section key={cat} id={`kat-${cat}`} className="scroll-mt-32">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="ord-h">{t.categories[cat]}</h2>
                <span className="ord-label text-right">{cat === "burger" ? o.burgerNote : cat === "sos" ? o.sauceNote : ""}</span>
              </div>
              <div className="plist">
                {MENU[cat].map((m, idx) => {
                  const name = itemName(t, m);
                  const eager = cat === "burger" && idx < 3; // ilk ekran: LCP görseli lazy olmasın
                  const qty = cart[m.id]?.qty ?? 0;
                  return (
                    <article key={m.id} className={"pcard" + (qty ? " on" : "")} onClick={() => setSheet(m)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSheet(m))}>
                      <ProductImage m={m} name={name} eager={eager} />
                      <div className="pbody">
                        <h3 className="tname">{name}</h3>
                        {itemDesc(t, m) ? <p className="pdesc">{itemDesc(t, m)}</p> : null}
                        <div className="prow">
                          <span className="price">{formatPrice(m.price)}</span>
                          <button
                            type="button"
                            className="addbtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              cartAdd(m.id, 1);
                            }}
                            aria-label={`${o.addShort} · ${name}`}
                          >
                            {qty ? `${o.addShort} · ${qty}` : o.addShort}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
      {sheet ? <ProductSheet item={sheet} onClose={closeSheet} onAdded={noop} /> : null}
      <CartBar />
    </main>
  );
}
