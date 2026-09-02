"use client";

import Image from "next/image";
import { HERO_ITEMS } from "@/lib/menu";
import { CUTOUTS, WIDE } from "./cutouts";
import { CENTER, N, slotIndex } from "./stageMath";

export type Bind = (name: string) => (el: HTMLElement | null) => void;

interface Props {
  active: number;
  bind: Bind;
}

/**
 * 5 slot: slot i → HERO_ITEMS[(active + i − CENTER) mod N]. Konumlar JS'te (Stage.render).
 * Her ürün: cutout + aynalanmış yansıma + zemin gölgesi. Üstte asılı disk, altta plint.
 */
export default function Arc({ active, bind }: Props) {
  return (
    <>
      <span className="disc discA" ref={bind("discA")} aria-hidden="true" />
      <div className="field">
        {Array.from({ length: N }, (_, i) => {
          const m = HERO_ITEMS[slotIndex(active, i, HERO_ITEMS.length)];
          const src = CUTOUTS[m.id];
          const a = Math.abs(i - CENTER);
          return (
            <div
              key={i}
              className={"item" + (WIDE[m.id] ? " wide" : "")}
              ref={bind(`item${i}`)}
              style={{ zIndex: i === CENTER ? 22 : 18 - a }}
              data-k={m.id}
            >
              <Image
                src={src}
                alt={i === CENTER ? `${m.name} burger` : ""}
                preload
                unoptimized
                ref={i === CENTER ? bind("centerImg") : undefined}
              />
              <span className="shad" aria-hidden="true" />
              <Image className="refl" src={src} alt="" aria-hidden="true" unoptimized />
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
