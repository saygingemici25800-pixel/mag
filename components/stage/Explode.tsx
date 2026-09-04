"use client";

import { STAGE_KEYS, type HeroId, type StageKey } from "@/lib/menu";
import type { StageMap } from "@/lib/katman";
import type { Bind } from "./Arc";

/** Yığın sırası yukarıdan aşağıya: üst ekmek · sos · peynir · et · alt ekmek */
export type LayerKey = "ekmekUst" | "sos" | "peynir" | "et" | "ekmekAlt";
export const LAYER_ORDER: LayerKey[] = ["ekmekUst", "sos", "peynir", "et", "ekmekAlt"];

/** Hangi claim hangi katman(lar)ı vurgular — EKMEK iki yarıyı birlikte öne çıkarır */
export const CLAIM_LAYERS: LayerKey[][] = [
  ["et"], // 0 · ET
  ["ekmekUst", "ekmekAlt"], // 1 · EKMEK
  ["peynir"], // 2 · PEYNİR
  ["sos"], // 3 · SOS & ÜSTÜ
];

/** Ekmek tek görsel: üst ve alt yarı ondan clip-path ile üretilir */
const CLIP: Partial<Record<LayerKey, string>> = {
  ekmekUst: "inset(0 0 52% 0)",
  ekmekAlt: "inset(48% 0 0 0)",
};

/** `<ad>.webp` → `<ad>@2x.webp` (scripts/cut-katman.mjs iki boy üretir) */
const srcSet2x = (src: string) => src.replace(/\.webp$/, "@2x.webp");

/** Katmanın hangi aşama görselinden geldiği */
const SOURCE: Record<LayerKey, StageKey> = {
  ekmekUst: "ekmek",
  sos: "sos",
  peynir: "peynir",
  et: "et",
  ekmekAlt: "ekmek",
};

interface Props {
  id: HeroId;
  stages: StageMap;
  bind: Bind;
}

/**
 * "Patlamış burger" — iddia bölümünde ürün fotoğrafının yerine geçer.
 *
 * Katmanlar saydam WebP; mix-blend-mode YOK. Konum/ölçek/parlaklık her karede Stage.render
 * tarafından yazılır (CSS geçişi yok, hareket tek kaynaktan gelir); yalnızca vurgu değişimi
 * 420 ms'lik CSS geçişiyle yumuşatılır.
 *
 * Aktif katmanın arkasındaki ışık ayrı bir eleman değil: her katmanın kendi `::before`i,
 * ürün accent rengiyle boyanmış eliptik radyal gradyan. Böylece katmanla birlikte hareket eder,
 * ayrı ayrı yanıp sönmez ve blur/backdrop-filter gerekmez.
 */
export default function Explode({ id, stages, bind }: Props) {
  const s = stages[id];
  if (!s || !STAGE_KEYS.every((k) => s[k])) return null;
  return (
    <div className="explode" ref={bind("explode")} aria-hidden="true">
      {LAYER_ORDER.map((k, i) => (
        <div key={k} className="exLayer" data-layer={k} ref={bind(`ex_${k}`)} style={{ zIndex: LAYER_ORDER.length - i }}>
          <span className="exGlow" aria-hidden="true" />
          {/* Katmanlar ancak iddia bölümünde (p≈.28) görünür: açılışta hero cutout'larıyla bant
              genişliği yarıştırmasınlar. Yavaş bağlantıda preloader'ı ~1.5 sn geciktiriyordu. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- yol build'de doğrulanır, boyut CSS'te */}
          <img
            src={s[SOURCE[k]]}
            srcSet={`${s[SOURCE[k]]} 560w, ${srcSet2x(s[SOURCE[k]]!)} 1024w`}
            /* sahnede çizildiği genişlik: mobilde ~525, masaüstünde ~1010 CSS px */
            sizes="(max-width: 900px) 525px, 1010px"
            alt=""
            loading="lazy"
            fetchPriority="low"
            decoding="async"
            style={CLIP[k] ? { clipPath: CLIP[k] } : undefined}
          />
        </div>
      ))}
    </div>
  );
}
