import type { StaticImageData } from "next/image";
import { HERO_ITEMS, type HeroId, type HeroItem } from "@/lib/menu";
import smooky from "@/public/assets/cut/smooky.webp";
import brisket from "@/public/assets/cut/brisket.webp";
import berry from "@/public/assets/cut/berry.webp";
import jalapeno from "@/public/assets/cut/jalapeno.webp";
import caesar from "@/public/assets/cut/caesar.webp";
import orjinal from "@/public/assets/cut/orjinal.webp";
import truffle from "@/public/assets/cut/truffle.webp";
import smookyM from "@/public/assets/cut-m/smooky.webp";
import brisketM from "@/public/assets/cut-m/brisket.webp";
import berryM from "@/public/assets/cut-m/berry.webp";
import jalapenoM from "@/public/assets/cut-m/jalapeno.webp";
import caesarM from "@/public/assets/cut-m/caesar.webp";
import orjinalM from "@/public/assets/cut-m/orjinal.webp";
import truffleM from "@/public/assets/cut-m/truffle.webp";

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
