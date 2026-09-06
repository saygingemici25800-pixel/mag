"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@/lib/i18n";
import type { HeroItem } from "@/lib/menu";
import { splitTitle } from "@/lib/menu";
import Ingredients from "@/components/order/Ingredients";
import BigTitle from "./BigTitle";
import type { Bind } from "./Arc";

interface Props {
  item: HeroItem;
  /** yerelleştirilmiş açıklama */
  desc: string;
  /** −1: ürün kopyası; 0–3: iddia */
  ci: number;
  claims: Messages["claims"];
  rail: Messages["rail"];
  bind: Bind;
  /** metin bloğunun tarafı: burgerin boş yanı (c0/c1 sol, c2/c3 sağ) */
  side: "left" | "right";
}

/**
 * Dive + 4 iddia. Burger tek planda yatay akar; metin her zaman burgerin BOŞ tarafında durur.
 * Aşama değişiminde yeni metin kendi tarafından içeri kayarak gelir (translateX 40px → 0, opaklık 0 → 1),
 * eski metin ters yöne kayıp söner. 420 ms, cubic-bezier(.22,1,.28,1) — CSS'te (.claimText).
 */
export default function Claims({ item, desc: itemDescription, ci, claims, rail, bind, side }: Props) {
  /* Görünen içerik: ci değişince önce çıkış (.out) oynar, sonra içerik değişip giriş (.in) oynar. */
  const [state, setState] = useState<{ shown: number; phase: "in" | "out" }>({ shown: ci, phase: "in" });
  const { shown, phase } = state;

  useEffect(() => {
    if (ci === shown) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const raf = requestAnimationFrame(() => setState({ shown: ci, phase: "in" }));
      return () => cancelAnimationFrame(raf);
    }
    /* önce çıkış (eski metin ters yöne kayıp söner), 210 ms sonra içerik değişip giriş oynar */
    const raf = requestAnimationFrame(() => setState((s) => ({ ...s, phase: "out" })));
    const id = window.setTimeout(() => setState({ shown: ci, phase: "in" }), 210);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
  }, [ci, shown]);

  const claim = shown >= 0 ? claims[shown] : null;
  const [l1, l2] = claim ? [claim.l1, claim.l2] : splitTitle(item.name);
  const desc = claim ? claim.d : `${itemDescription}.`;

  return (
    <section className="scene scDive" ref={bind("scDive")}>
      <div className={`claimText ${side} ${phase}`} ref={bind("claimText")} data-side={side} data-ci={shown}>
        <div className="badge" style={{ opacity: claim ? 1 : 0 }}>
          <b>×</b>
          <s>{claim?.no ?? claims[0].no}</s>
        </div>
        <BigTitle l1={l1} l2={l2} className={claim ? "claimTitle" : ""} />
        <p>
          {claim ? desc : <Ingredients text={itemDescription} />}
          {claim ? "" : "."}
        </p>
      </div>
      <div className="rail" ref={bind("rail")} aria-hidden="true">
        {rail.map((icon, r) => (
          <i key={r} className={r === ci ? "on" : undefined}>
            {icon}
          </i>
        ))}
      </div>
    </section>
  );
}
