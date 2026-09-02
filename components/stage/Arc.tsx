"use client";

import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { HERO_ITEMS } from "@/lib/menu";
import { CUTOUTS, CUTOUTS_M, DESKTOP_MQ, MOBILE_MQ, WIDE } from "./cutouts";
import { CENTER, N, slotIndex } from "./stageMath";

export type Bind = (name: string) => (el: HTMLElement | null) => void;

interface Props {
  active: number;
  bind: Bind;
}

interface CutoutProps {
  id: keyof typeof CUTOUTS;
  alt: string;
  focus: boolean;
  className?: string;
  imgRef?: (el: HTMLElement | null) => void;
}

/**
 * Cutout: <900px'te 300px'lik mobil kopya, üstünde orijinal (art direction → <picture>).
 * Orijinal baytlar (unoptimized): alfa kenarları yeniden kodlanmasın. Odaktaki high, yanlar low öncelik.
 */
function Cutout({ id, alt, focus, className, imgRef }: CutoutProps) {
  const { props } = getImageProps({
    src: CUTOUTS[id],
    alt,
    unoptimized: true,
    loading: "eager",
    fetchPriority: focus ? "high" : "low",
    className,
  });
  return (
    <picture>
      <source media={MOBILE_MQ} srcSet={CUTOUTS_M[id].src} width={CUTOUTS_M[id].width} height={CUTOUTS_M[id].height} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt getImageProps içinden geliyor */}
      <img {...props} ref={imgRef} />
    </picture>
  );
}

/**
 * 5 slot: slot i → HERO_ITEMS[(active + i − CENTER) mod N]. Konumlar JS'te (Stage.render).
 * Her ürün: cutout + aynalanmış yansıma + zemin gölgesi. Üstte asılı disk, altta plint.
 */
export default function Arc({ active, bind }: Props) {
  // odaktaki cutout: iki varyant için medya sorgulu preload — tarayıcı yalnızca eşleşeni çeker
  const focusId = HERO_ITEMS[slotIndex(active, CENTER, HERO_ITEMS.length)].id;
  preload(CUTOUTS[focusId].src, { as: "image", media: DESKTOP_MQ, fetchPriority: "high" });
  preload(CUTOUTS_M[focusId].src, { as: "image", media: MOBILE_MQ, fetchPriority: "high" });

  return (
    <>
      <span className="disc discA" ref={bind("discA")} aria-hidden="true" />
      <div className="field">
        {Array.from({ length: N }, (_, i) => {
          const m = HERO_ITEMS[slotIndex(active, i, HERO_ITEMS.length)];
          const a = Math.abs(i - CENTER);
          const focus = i === CENTER;
          return (
            <div
              key={i}
              className={"item" + (WIDE[m.id] ? " wide" : "") + (focus ? " focus" : "")}
              ref={bind(`item${i}`)}
              style={{ zIndex: focus ? 22 : 18 - a }}
              data-k={m.id}
            >
              <Cutout id={m.id} alt={focus ? `${m.name} burger` : ""} focus={focus} imgRef={focus ? bind("centerImg") : undefined} />
              <span className="shad" aria-hidden="true" />
              <Cutout id={m.id} alt="" focus={focus} className="refl" />
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
