"use client";

import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { HERO_ITEMS, type HeroId } from "@/lib/menu";
import { CUTOUTS, CUTOUTS_M, DESKTOP_MQ, MOBILE_MQ, WIDE, type ExtraCutouts } from "./cutouts";
import { CENTER, N, slotIndex } from "./stageMath";

export type Bind = (name: string) => (el: HTMLElement | null) => void;

interface Props {
  active: number;
  bind: Bind;
  /** build'de dosya sisteminde bulunan ek cutout'lar (statik import'u olmayan ürünler) */
  extra?: ExtraCutouts;
}

interface CutoutProps {
  id: HeroId;
  name: string;
  alt: string;
  focus: boolean;
  className?: string;
  imgRef?: (el: HTMLElement | null) => void;
  extra?: ExtraCutouts;
}

/**
 * Cutout: <900px'te 300px'lik mobil kopya, üstünde orijinal (art direction → <picture>).
 * Statik import yoksa: build'de bulunan dosya (extra) → düz <img>; o da yoksa tipografik kutu (geçici görsel).
 */
function Cutout({ id, name, alt, focus, className, imgRef, extra }: CutoutProps) {
  const st = CUTOUTS[id];
  if (st) {
    const { props } = getImageProps({ src: st, alt, unoptimized: true, loading: "eager", fetchPriority: focus ? "high" : "low", className });
    const m = CUTOUTS_M[id];
    return (
      <picture>
        {m ? <source media={MOBILE_MQ} srcSet={m.src} width={m.width} height={m.height} /> : null}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt getImageProps içinden geliyor */}
        <img {...props} ref={imgRef} />
      </picture>
    );
  }
  const ex = extra?.[id];
  if (ex) {
    return (
      <picture>
        {ex.srcM ? <source media={MOBILE_MQ} srcSet={ex.srcM} /> : null}
        <img src={ex.src} alt={alt} className={className} loading="eager" fetchPriority={focus ? "high" : "low"} ref={imgRef as (el: HTMLImageElement | null) => void} />
      </picture>
    );
  }
  // geçici görsel: cutout kutusuyla aynı boyutta tipografik kutu (refl için aynı kutu, className korunur)
  return (
    <div className={"ph " + (className ?? "")} ref={imgRef as (el: HTMLDivElement | null) => void} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <span>{name}</span>
    </div>
  );
}

/**
 * 8 slot: slot i → HERO_ITEMS[(active + i − CENTER) mod N]. Konumlar JS'te (Stage.render).
 * Görünür slotlar t=−2..+2; dıştakiler x=t·spacing'de opacity 0 ile hazır bekler.
 */
export default function Arc({ active, bind, extra }: Props) {
  const focusId = HERO_ITEMS[slotIndex(active, CENTER, HERO_ITEMS.length)].id;
  const fc = CUTOUTS[focusId],
    fm = CUTOUTS_M[focusId];
  if (fc) preload(fc.src, { as: "image", media: DESKTOP_MQ, fetchPriority: "high" });
  if (fm) preload(fm.src, { as: "image", media: MOBILE_MQ, fetchPriority: "high" });

  return (
    <>
      <span className="disc discA" ref={bind("discA")} aria-hidden="true" />
      <div className="field">
        {Array.from({ length: N }, (_, i) => {
          const m = HERO_ITEMS[slotIndex(active, i, HERO_ITEMS.length)];
          const focus = i === CENTER;
          const hasImg = Boolean(CUTOUTS[m.id] || extra?.[m.id]);
          return (
            <div key={i} className={"item" + (WIDE[m.id] ? " wide" : "") + (focus ? " focus" : "") + (hasImg ? "" : " noimg")} ref={bind(`item${i}`)} data-k={m.id} style={{ zIndex: focus ? 22 : 22 - Math.min(Math.abs(i - CENTER), 4) * 2 }}>
              <Cutout id={m.id} name={m.name} alt={focus ? `${m.name} burger` : ""} focus={focus} imgRef={focus ? bind("centerImg") : undefined} extra={extra} />
              <span className="shad" aria-hidden="true" />
              <Cutout id={m.id} name={m.name} alt="" focus={focus} className="refl" extra={extra} />
            </div>
          );
        })}
      </div>
      <span className="disc discB" ref={bind("discB")} aria-hidden="true" />

      <div className="dots dotsL" ref={bind("dotsL")} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="dots dotsR" ref={bind("dotsR")} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </>
  );
}
