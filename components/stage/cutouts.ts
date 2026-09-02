import type { StaticImageData } from "next/image";
import type { HeroId } from "@/lib/menu";
import smooky from "@/public/assets/cut/smooky.webp";
import brisket from "@/public/assets/cut/brisket.webp";
import berry from "@/public/assets/cut/berry.webp";
import jalapeno from "@/public/assets/cut/jalapeno.webp";
import caesar from "@/public/assets/cut/caesar.webp";

/** Fondan kesilmiş 5 burger (WebP, 480px yükseklik). */
export const CUTOUTS: Record<HeroId, StaticImageData> = { smooky, brisket, berry, jalapeno, caesar };

/** Geniş cutout'lar sahnede daha kısa gösterilir (proto `WIDE`). */
export const WIDE: Partial<Record<HeroId, true>> = { smooky: true, caesar: true };
