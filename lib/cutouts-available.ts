/**
 * Yalnızca sunucu/build: public/assets/cut/<id>.webp (ve cut-m) taranır. Statik import'u olmayan hero ürünler
 * için dosya gelince otomatik kullanılır; kod değişmez (statik sayfa → yeni build).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { ExtraCutouts } from "@/components/stage/cutouts";
import { CUTOUTS } from "@/components/stage/cutouts";
import { HERO_ITEMS } from "@/lib/menu";

export function extraCutouts(): ExtraCutouts {
  const out: ExtraCutouts = {};
  for (const m of HERO_ITEMS) {
    if (CUTOUTS[m.id]) continue;
    const full = `/assets/cut/${m.id}.webp`;
    if (!existsSync(path.join(process.cwd(), "public", full))) continue;
    const mob = `/assets/cut-m/${m.id}.webp`;
    out[m.id] = { src: full, srcM: existsSync(path.join(process.cwd(), "public", mob)) ? mob : undefined };
  }
  return out;
}
