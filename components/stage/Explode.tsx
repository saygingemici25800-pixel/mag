"use client";

import { STAGE_KEYS, type HeroId, type StageKey } from "@/lib/menu";
import type { StageMap } from "@/lib/katman";
import METRICS from "@/lib/katmanMetrics.json";
import CUT from "@/lib/cutCenters.json";
import type { Bind } from "./Arc";
import { LAYER_ORDER, type LayerKey, type StackGeo } from "./stageMath";

/** Ekmek tek görsel: üst ve alt yarı ondan clip-path ile üretilir (kesim çizgisi %48) */
const SPLIT = 0.48;
const CLIP: Partial<Record<LayerKey, string>> = {
  ekmekUst: `inset(0 0 ${(100 - SPLIT * 100).toFixed(0)}% 0)`,
  ekmekAlt: `inset(${(SPLIT * 100).toFixed(0)}% 0 0 0)`,
};

/** `<ad>.webp` → `<ad>@2x.webp` (scripts/cut-katman.mjs iki boy üretir) */
const srcSet2x = (src: string) => src.replace(/\.webp$/, "@2x.webp");

/** Katmanların birbirine göre genişlik oranı (ekmek en geniş = 1) — biri devasa, öbürü minik olmasın */
const TARGET_W: Record<LayerKey, number> = { ekmekUst: 1, sos: 0.8, peynir: 0.88, et: 0.92, ekmekAlt: 1 };

type Metric = { w: number; h: number; cx: number; cy: number };
type Body = { x0: number; x1: number; y0: number; y1: number };
const metrics = METRICS as Record<string, Metric>;
const cuts = CUT as Record<string, { cx: number; cy: number; box?: Body; body?: Body }>;

/** Dosya adından ölçüm anahtarı: "/assets/katman/smooky-1-et.webp" → "smooky-1-et" */
const metricKey = (src: string) => src.split("/").pop()!.replace(/\.webp$/, "");

/** Katmanın hangi aşama görselinden geldiği */
const SOURCE: Record<LayerKey, StageKey> = { ekmekUst: "ekmek", sos: "sos", peynir: "peynir", et: "et", ekmekAlt: "ekmek" };

/** Ölçülen içerik genişliğini hedef orana normalize eden ölçek (referans: ekmeğin ölçülen genişliği) */
function layerScale(src: string, k: LayerKey, refW: number): number {
  const m = metrics[metricKey(src)];
  return m?.w ? (TARGET_W[k] * refW) / m.w : 1;
}

/**
 * Yığının fotoğraf kutusu içindeki yerleşimi — cutout'un kutu ölçüsünden (cw×ch, ölçeksiz px).
 *
 * KURAL: birleşik yığın (aralık 0) fotoğrafın GÖVDESİYLE aynı yükseklikte ve aynı merkezde
 * olmalı ki takas tek karede fark edilmesin. Gövde = cutout'ta ≥%50 dolu sütun/satırlar
 * (bacon gibi çıkıntılar hariç; scripts/cut-center.mjs ölçer). Kare kenarı S, ekmeğin
 * ölçülen içerik yüksekliği gövde yüksekliğine eşitlenerek bulunur: S = gövdeH / ekmekH.
 * Genişlik ayrıca eşitlenemez (fotoğraf 1.2–1.4 en/boy, ekmek render'ı 0.94) — bilinen kalıntı.
 */
export function stackGeometry(id: HeroId, stages: StageMap, cw: number, ch: number): StackGeo | null {
  const s = stages[id];
  if (!s || !STAGE_KEYS.every((k) => s[k]) || !cw || !ch) return null;
  const cut = cuts[id];
  const body: Body = cut?.body ?? cut?.box ?? { x0: 0, x1: 1, y0: 0, y1: 1 };
  const bun = metrics[metricKey(s.ekmek!)];
  if (!bun) return null;
  const bodyH = (body.y1 - body.y0) * ch;
  const S = bodyH / bun.h;
  const refW = bun.w;
  const layers = {} as StackGeo["layers"];
  for (const k of LAYER_ORDER) {
    const src = s[SOURCE[k]]!;
    const m = metrics[metricKey(src)];
    const sc = layerScale(src, k, refW);
    /* içerik, görsel merkezi etrafında sc ile ölçeklenir (transform-origin merkez) */
    const yc = 0.5 + ((m?.cy ?? 0.5) - 0.5) * sc;
    let y0 = yc - ((m?.h ?? 1) * sc) / 2;
    let y1 = yc + ((m?.h ?? 1) * sc) / 2;
    if (k === "ekmekUst") y1 = Math.min(y1, SPLIT);
    if (k === "ekmekAlt") y0 = Math.max(y0, SPLIT);
    layers[k] = { w: (m?.w ?? 1) * S * sc, y0: y0 * S, y1: y1 * S };
  }
  return {
    S,
    cx: ((body.x0 + body.x1) / 2) * cw,
    cy: ((body.y0 + body.y1) / 2) * ch,
    bunY0: (0.5 - bun.h / 2) * S,
    bunY1: (0.5 + bun.h / 2) * S,
    layers,
  };
}

interface Props {
  id: HeroId;
  stages: StageMap;
  bind: Bind;
}

/**
 * "Patlamış burger" — iddia bölümünde ürün fotoğrafının YERİNE geçer (aynı anda ikisi görünmez).
 *
 * `.explode` fotoğrafın kutusuyla aynı ölçü ve aynı transform'u alır; içindeki `.exStack`
 * karesi fotoğraf gövdesine oturur (stackGeometry). Takas tek karede display ile yapılır;
 * konum/aralık her karede Stage.render'dan yazılır. Tek düzlem: yalnızca translateY.
 *
 * Işık tek elemandır (`.exLight`), katmanların ARKASINDA durur ve aktif katmanla birlikte kayar.
 * Katmanlar saydam WebP; mix-blend-mode, filter, perspektif yok.
 */
export default function Explode({ id, stages, bind }: Props) {
  const s = stages[id];
  if (!s || !STAGE_KEYS.every((k) => s[k])) return null;
  const cut = cuts[id];
  const body: Body = cut?.body ?? cut?.box ?? { x0: 0, x1: 1, y0: 0, y1: 1 };
  const bun = metrics[metricKey(s.ekmek!)];
  const refW = bun?.w ?? 1;
  /* kare kenarı / kutu yüksekliği ve gövde merkezi — CSS calc bunlarla yerleştirir */
  const vars = {
    "--exK": bun ? ((body.y1 - body.y0) / bun.h).toFixed(4) : "1",
    "--exCx": ((body.x0 + body.x1) / 2).toFixed(4),
    "--exCy": ((body.y0 + body.y1) / 2).toFixed(4),
  } as React.CSSProperties;
  return (
    <div className="explode" ref={bind("explode")} aria-hidden="true" style={vars}>
      <div className="exStack">
        {/* aktif katmanın arkasındaki yerel ışık: ürünün accent rengi, radyal gradyan, blur yok */}
        <span className="exLight" ref={bind("exLight")} aria-hidden="true" />
        {LAYER_ORDER.map((k, i) => (
          <div key={k} className="exLayer" data-layer={k} ref={bind(`ex_${k}`)} style={{ zIndex: LAYER_ORDER.length - i }}>
            {/* Katmanlar ancak iddia bölümünde (p≈.3) görünür: açılışta hero cutout'larıyla bant
                genişliği yarıştırmasınlar. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- yol build'de doğrulanır, boyut CSS'te */}
            <img
              src={s[SOURCE[k]]}
              srcSet={`${s[SOURCE[k]]} 560w, ${srcSet2x(s[SOURCE[k]]!)} 1024w`}
              sizes="(max-width: 900px) 525px, 1010px"
              alt=""
              loading="lazy"
              fetchPriority="low"
              decoding="async"
              style={{
                ...(CLIP[k] ? { clipPath: CLIP[k] } : null),
                /* Ölçü normalizasyonu ve yatay merkez düzeltmesi görselde (statik);
                   `.exLayer`in transform'unu her karede JS yazıyor (yalnızca translateY). */
                transform: `translateX(${((0.5 - (metrics[metricKey(s[SOURCE[k]]!)]?.cx ?? 0.5)) * 100).toFixed(2)}%) scale(${layerScale(s[SOURCE[k]]!, k, refW).toFixed(4)})`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
