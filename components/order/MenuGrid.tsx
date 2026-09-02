"use client";

import Image from "next/image";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";
import { CATEGORY_LABELS, MENU, formatPrice, type Category, type HeroId, type MenuItem } from "@/lib/menu";
import { CUTOUTS_M } from "@/components/stage/cutouts";

export interface CartLine {
  qty: number;
  note: string;
}
export type Cart = Record<string, CartLine>;

interface Props {
  t: Messages["order"];
  cart: Cart;
  onChange: (id: string, patch: Partial<CartLine> | null) => void;
}

const ORDER: Category[] = ["burger", "taco", "noodle", "yan", "sos", "icecek"];

function ProductCard({ m, line, t, onChange }: { m: MenuItem; line?: CartLine; t: Messages["order"]; onChange: Props["onChange"] }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const qty = line?.qty ?? 0;
  const set = (q: number) => (q <= 0 ? onChange(m.id, null) : onChange(m.id, { qty: q, note: line?.note ?? "" }));
  const pic = m.hero ? CUTOUTS_M[m.id as HeroId] : null;

  return (
    <article className={"card" + (qty ? " on" : "") + (pic ? "" : " typo")} style={m.accent ? ({ "--accent": m.accent } as React.CSSProperties) : undefined}>
      {pic ? <Image src={pic} alt="" className="pic" sizes="(max-width: 640px) 45vw, 240px" /> : null}
      <div className="flex items-start justify-between gap-3">
        <h3 className="tname">{m.name}</h3>
        <span className="price">{formatPrice(m.price)}</span>
      </div>
      {m.desc ? <p>{m.desc}</p> : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
        {qty ? (
          <span className="qty">
            <button type="button" aria-label="Azalt" onClick={() => set(qty - 1)}>
              −
            </button>
            <b>{qty}</b>
            <button type="button" aria-label="Artır" onClick={() => set(qty + 1)}>
              +
            </button>
          </span>
        ) : (
          <button type="button" className="addbtn" onClick={() => set(1)}>
            {t.add}
          </button>
        )}
        {qty ? (
          <button type="button" className="ord-label cursor-pointer hover:text-cream" onClick={() => setNoteOpen((v) => !v)}>
            {t.noteToggle}
            {line?.note ? " ·" : ""}
          </button>
        ) : null}
      </div>
      {qty && noteOpen ? (
        <input
          className="ctl"
          placeholder={t.notePlaceholder}
          value={line?.note ?? ""}
          maxLength={120}
          onChange={(e) => onChange(m.id, { qty, note: e.target.value })}
        />
      ) : null}
    </article>
  );
}

/** Kategoriler: Burger · Taco · Noodle · Yan · Sos · İçecek */
export default function MenuGrid({ t, cart, onChange }: Props) {
  return (
    <div className="flex flex-col gap-12">
      {ORDER.map((cat) => (
        <section key={cat} id={`kat-${cat}`} className="scroll-mt-28">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="ord-h">{CATEGORY_LABELS[cat]}</h2>
            <span className="ord-label">{cat === "burger" ? t.burgerNote : cat === "sos" ? t.sauceNote : ""}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MENU[cat].map((m) => (
              <ProductCard key={m.id} m={m} line={cart[m.id]} t={t} onChange={onChange} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
