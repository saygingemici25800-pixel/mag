/**
 * Dilimler — iddia bölümünde hero fotoğrafının kendisinin dört yatay dilimi (public/assets/dilim).
 * Yalnızca sunucu/build: meta.json okunur, dört dosyası da olan ürünler döner. Eksik üründe bölüm
 * fotoğrafla çalışır (Stage `sliced=false`). Yeni ürün: kes.py → dilimler + meta.json → yeni build.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { HeroId } from "@/lib/menu";
import { SLICE_DIR, SLICE_NAMES, type SliceMeta } from "@/lib/dilim-paths";

export type SliceMap = Partial<Record<HeroId, SliceMeta>>;

export function availableSlices(): SliceMap {
  const dir = path.join(process.cwd(), "public", SLICE_DIR);
  const metaPath = path.join(dir, "meta.json");
  if (!existsSync(metaPath)) return {};
  const raw = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, { size: number[]; bandCenterPct: number[] }>;
  const out: SliceMap = {};
  for (const [id, m] of Object.entries(raw)) {
    const complete = SLICE_NAMES.every((n) => existsSync(path.join(dir, `${id}-${n}.webp`)));
    if (!complete || m.bandCenterPct?.length !== 4 || m.size?.length !== 2) continue;
    out[id as HeroId] = { size: [m.size[0], m.size[1]], bandCenterPct: m.bandCenterPct as SliceMeta["bandCenterPct"] };
  }
  return out;
}
