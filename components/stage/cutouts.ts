import type { StaticImageData } from "next/image";
import type { HeroId } from "@/lib/menu";
import smooky from "@/public/assets/cut/smooky.webp";
import brisket from "@/public/assets/cut/brisket.webp";
import berry from "@/public/assets/cut/berry.webp";
import jalapeno from "@/public/assets/cut/jalapeno.webp";
import caesar from "@/public/assets/cut/caesar.webp";
import smookyM from "@/public/assets/cut-m/smooky.webp";
import brisketM from "@/public/assets/cut-m/brisket.webp";
import berryM from "@/public/assets/cut-m/berry.webp";
import jalapenoM from "@/public/assets/cut-m/jalapeno.webp";
import caesarM from "@/public/assets/cut-m/caesar.webp";

/** Fondan kesilmiş cutout'lar (WebP, 480px). Eksik ürünler (orjinal, truffle, citir): dosya gelince build'de bulunur → lib/cutouts-available.ts */
export const CUTOUTS: Partial<Record<HeroId, StaticImageData>> = { smooky, brisket, berry, jalapeno, caesar };

/** Mobil kopyalar (300px, kalite 72) — `pnpm assets:cut-m`. */
export const CUTOUTS_M: Partial<Record<HeroId, StaticImageData>> = { smooky: smookyM, brisket: brisketM, berry: berryM, jalapeno: jalapenoM, caesar: caesarM };

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
