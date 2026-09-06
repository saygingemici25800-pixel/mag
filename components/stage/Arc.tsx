"use client";

import { preload } from "react-dom";
import type { HeroId } from "@/lib/menu";
import type { SliceMeta } from "@/lib/dilim-paths";
import { CUTOUTS, CUTOUTS_M, DESKTOP_MQ, MOBILE_MQ, aspectOf, heroProducts, type ExtraCutouts } from "./cutouts";
import { Card } from "./Hero";
import { CENTER, N, slotIndex } from "./stageMath";

export type Bind = (name: string) => (el: HTMLElement | null) => void;

interface Props {
  active: number;
  bind: Bind;
  /** build'de dosya sisteminde bulunan ek cutout'lar (statik import'u olmayan ürünler) */
  extra?: ExtraCutouts;
  /** ürün başına dilim meta'sı (public/assets/dilim/meta.json); yoksa iddia bölümü fotoğrafla çalışır */
  slices?: Partial<Record<HeroId, SliceMeta>>;
}

/**
 * 8 slot (p = −4..3, referans SLOTS): slot i → ürün[(active + i − CENTER) mod count]. Konumlar JS'te (Stage.render).
 * Ürünler menu.ts'ten, yalnızca fotoğrafı olanlar (heroProducts) — fotoğraf gelince dizi kendiliğinden büyür;
 * 8 slot sarmalı çalıştığı için count < 8 iken bir ürün iki slotta (ekran dışı) durur.
 */
export default function Arc({ active, bind, extra, slices }: Props) {
  const list = heroProducts(extra);
  const count = list.length;
  const focusId = list[slotIndex(active, CENTER, count)].id;
  const fc = CUTOUTS[focusId],
    fm = CUTOUTS_M[focusId];
  if (fc) preload(fc.src, { as: "image", media: DESKTOP_MQ, fetchPriority: "high" });
  if (fm) preload(fm.src, { as: "image", media: MOBILE_MQ, fetchPriority: "high" });

  return (
    <div className="field">
      {Array.from({ length: N }, (_, i) => {
        const m = list[slotIndex(active, i, count)];
        const focus = i === CENTER;
        const hasImg = Boolean(CUTOUTS[m.id] || extra?.[m.id]);
        return <Card key={i} id={m.id} name={m.name} focus={focus} slot={i} ar={aspectOf(m.id)} extra={extra} meta={focus ? slices?.[m.id] : undefined} bind={bind} hasImg={hasImg} alt={focus ? `${m.name} burger` : ""} />;
      })}
    </div>
  );
}
