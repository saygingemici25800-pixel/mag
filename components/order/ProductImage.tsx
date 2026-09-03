"use client";

import Image from "next/image";
import { CUTOUTS_M } from "@/components/stage/cutouts";
import type { HeroId, MenuItem } from "@/lib/menu";

/** Kare ürün görseli: cutout (koyu kutu) → hero jpg → baş harf. */
export default function ProductImage({ m, name, size = 96, big = false, eager = false }: { m: MenuItem; name: string; size?: number; big?: boolean; eager?: boolean }) {
  const src = m.hero ? CUTOUTS_M[m.id as HeroId] : undefined;
  if (src) {
    return (
      <div className={"pimg" + (big ? " big" : "")} style={{ "--acc": m.accent ?? "var(--kraft)" } as React.CSSProperties}>
        <Image src={src} alt="" sizes={big ? "(max-width: 640px) 90vw, 480px" : `${size}px`} loading={eager || big ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
      </div>
    );
  }
  // hero jpg yalnızca 5 burger için var (aynı ürünler) → diğerleri tipografik
  return (
    <div className={"pimg typo" + (big ? " big" : "")} aria-hidden="true">
      <span>{name.trim().charAt(0).toLocaleUpperCase("tr-TR")}</span>
    </div>
  );
}
