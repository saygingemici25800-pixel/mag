import type { StaticImageData } from "next/image";
import { HERO_ITEMS, type HeroId, type HeroItem } from "@/lib/menu";
import smooky from "@/public/urun/smooky.webp";
import brisket from "@/public/urun/brisket.webp";
import berry from "@/public/urun/berry.webp";
import jalapeno from "@/public/urun/jalapeno.webp";
import caesar from "@/public/urun/caesar.webp";
import orjinal from "@/public/urun/orjinal.webp";
import truffle from "@/public/urun/truffle.webp";
import smookyM from "@/public/urun/mobil/smooky.webp";
import brisketM from "@/public/urun/mobil/brisket.webp";
import berryM from "@/public/urun/mobil/berry.webp";
import jalapenoM from "@/public/urun/mobil/jalapeno.webp";
import caesarM from "@/public/urun/mobil/caesar.webp";
import orjinalM from "@/public/urun/mobil/orjinal.webp";
import truffleM from "@/public/urun/mobil/truffle.webp";

/** Fondan kesilmiş cutout'lar (WebP, 480px). Dosya adı = ürün id'si.
    Eksik ürün (citir): dosya gelince build'de bulunur → lib/cutouts-available.ts */
export const CUTOUTS: Partial<Record<HeroId, StaticImageData>> = { smooky, brisket, berry, jalapeno, caesar, orjinal, truffle };

/** Mobil kopyalar (300px, kalite 72) — `pnpm assets:cut-m`. */
export const CUTOUTS_M: Partial<Record<HeroId, StaticImageData>> = { smooky: smookyM, brisket: brisketM, berry: berryM, jalapeno: jalapenoM, caesar: caesarM, orjinal: orjinalM, truffle: truffleM };

/** Build'de dosya sisteminde bulunan ek cutout'lar (statik import'suz) */
export interface ExtraCutout {
  src: string;
  srcM?: string;
}
export type ExtraCutouts = Partial<Record<HeroId, ExtraCutout>>;

/** <900px medya sorgusu — CSS'teki kırılımla aynı. */
export const MOBILE_MQ = "(max-width: 899px)";
export const DESKTOP_MQ = "(min-width: 900px)";

/** Geniş cutout'lar sahnede daha kısa gösterilir (proto `WIDE`). */
export const WIDE: Partial<Record<HeroId, true>> = { smooky: true, caesar: true };

/** Sahnede dönen ürünler: menu.ts'teki hero ürünlerinden fotoğrafı olanlar (statik import ya da build'de bulunan dosya).
    Eksik ürünün fotoğrafı gelince dizi kendiliğinden büyür; 8 slot sarmalı olduğu için N'e bağımlı kod yok. */
export function heroProducts(extra?: ExtraCutouts): HeroItem[] {
  return HERO_ITEMS.filter((m) => CUTOUTS[m.id] || extra?.[m.id]);
}

/** Cutout en/boy oranı (kartın içindeki görsel kutusu: contain) — statik import'ta bilinir, ek dosyada varsayılan */
export const DEFAULT_ASPECT = 1.5;
export function aspectOf(id: HeroId): number {
  const st = CUTOUTS[id];
  return st ? st.width / st.height : DEFAULT_ASPECT;
}
