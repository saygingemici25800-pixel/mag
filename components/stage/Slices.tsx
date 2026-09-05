"use client";

import type { HeroId } from "@/lib/menu";
import { SLICE_NAMES, sliceSrc, type SliceMeta } from "@/lib/dilim-paths";
import type { Bind } from "./Arc";

/**
 * İddia bölümü: hero fotoğrafının dört yatay dilimi, odaktaki .item'ın içinde, fotoğrafla aynı kutuda
 * (inset:0, %100). Aralık kapalıyken üst üste = birebir fotoğraf. Durum sınıfları Stage.render yazar:
 *   .item.sliced  → fotoğraf/yansıma görünmez, dilimler görünür (takas)
 *   .slices.open  → aralık açık (yalnızca translateY), sahne rotate(-1.4deg) translateX(-2%)
 *   .slices.aN    → aktif dilim N (1), diğerleri .12; ışık N'in bandCenterPct'sine kayar
 * Geçişler CSS'te (800 ms cubic-bezier(.22,1,.28,1)); filtre yok, karartma opaklıkla.
 */
export default function Slices({ id, meta, bind, inner }: { id: HeroId; meta: SliceMeta; bind: Bind; inner?: boolean }) {
  const vars = Object.fromEntries(meta.bandCenterPct.map((c, i) => [`--c${i}`, String(c)])) as React.CSSProperties;
  const body = (
    <>
      <span className="sLight" />
      {SLICE_NAMES.map((n, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- fotoğrafın dilimi; unoptimized, boyut kutudan
        <img key={n} className={`s s${i}`} src={sliceSrc(id, i)} alt="" loading="eager" fetchPriority="low" decoding="async" draggable={false} data-slice={i} />
      ))}
    </>
  );
  /* inner: dış .slices kapsayıcısını çağıran verir (StaticFallback — sabit açık, sınıflar orada) */
  if (inner) return body;
  return (
    <div className="slices" ref={bind("slices")} style={vars} aria-hidden="true" data-slices={id}>
      {body}
    </div>
  );
}
