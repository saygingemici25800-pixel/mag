/**
 * Katman görselleri — yalnızca sunucu/build. public/assets/katman taranır; dosyası olmayan aşama undefined.
 * Statik sayfalar build'de üretildiği için yeni dosya = yeni build (deploy). Kod değişmez.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { HERO_ITEMS, STAGE_KEYS, type HeroId, type StageKey } from "@/lib/menu";

export type StageMap = Partial<Record<HeroId, Partial<Record<StageKey, string>>>>;

export function availableStages(): StageMap {
  const out: StageMap = {};
  for (const m of HERO_ITEMS) {
    const found: Partial<Record<StageKey, string>> = {};
    for (const st of m.stages ?? []) {
      if (existsSync(path.join(process.cwd(), "public", st.image))) found[st.key] = st.image;
    }
    if (Object.keys(found).length) out[m.id] = found;
  }
  return out;
}

/**
 * "Patlamış burger" yalnızca DÖRT katmanı da tam olan üründe kurulabilir.
 * Eksik olanlarda iddia bölümünde mevcut ürün fotoğrafı kalır.
 */
export function hasLayers(stages: StageMap, id: HeroId): boolean {
  const s = stages[id];
  return Boolean(s) && STAGE_KEYS.every((k) => Boolean(s?.[k]));
}

/** Dört katmanı tam olan ürünlerin kimlikleri (build'de hesaplanır) */
export function layeredIds(stages: StageMap = availableStages()): HeroId[] {
  return HERO_ITEMS.map((m) => m.id).filter((id) => hasLayers(stages, id));
}
