"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroId } from "@/lib/menu";
import type { SliceMeta } from "@/lib/dilim-paths";
import { CUTOUTS, CUTOUTS_M, type ExtraCutouts } from "./cutouts";
import Slices from "./Slices";
import type { Bind } from "./Arc";

/**
 * Hero görsel katmanı — docs/ref/hero/hero.html'in birebir React karşılığı.
 * Sayılar, gradyanlar ve SVG referanstan; tipografi sitenin Comico/Bonny'si.
 * Kartların konumu Stage.render'dan (stageMath: hero pozu = referans carousel matematiği, offset'li tween);
 * burada yalnızca yapı ve durum (isim solup gelme, çubuk/sayaç).
 * Işık katmanı kontrol paneli (Armatür/Hüzme/Havuz/Yansıma anahtarları) bilerek yok.
 */

/* ---- Armatür: referans SVG olduğu gibi (hex'ler kopyalanan varlığın kendisi; palette testinde muaf) ---- */
export function Lamp({ bind }: { bind: Bind }) {
  return (
    <div className="lamp" ref={bind("lamp")} aria-hidden="true">
      <svg viewBox="0 0 400 220" aria-hidden="true">
        <defs>
          <linearGradient id="domeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2233" />
            <stop offset=".55" stopColor="#110c17" />
            <stop offset="1" stopColor="#1c1524" />
          </linearGradient>
          <linearGradient id="domeSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".07" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="skirtGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a2416" />
            <stop offset=".3" stopColor="#c98a44" />
            <stop offset=".65" stopColor="#f3c581" />
            <stop offset="1" stopColor="#8a5a2c" />
          </linearGradient>
          <linearGradient id="skirtSide" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity=".55" />
            <stop offset=".2" stopColor="#000" stopOpacity="0" />
            <stop offset=".8" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".55" />
          </linearGradient>
          <linearGradient id="knob" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b3242" />
            <stop offset="1" stopColor="#0c0810" />
          </linearGradient>
          <radialGradient id="halo2" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFD662" stopOpacity=".22" />
            <stop offset="1" stopColor="#FFD662" stopOpacity="0" />
          </radialGradient>
          <pattern id="ribsDark" width="7" height="10" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="3.2" height="10" fill="#fff" opacity=".05" />
            <rect x="3.2" y="0" width="1" height="10" fill="#000" opacity=".5" />
          </pattern>
          <pattern id="ribsGlow" width="7" height="10" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="2.4" height="10" fill="#fff5dc" opacity=".55" />
            <rect x="2.4" y="0" width="2.2" height="10" fill="#4a2c14" opacity=".55" />
            <rect x="4.6" y="0" width="2.4" height="10" fill="#000" opacity=".12" />
          </pattern>
          <clipPath id="domeClip">
            <path d="M52 132 C52 60 130 26 200 26 C270 26 348 60 348 132 Z" />
          </clipPath>
        </defs>
        <ellipse cx="200" cy="175" rx="230" ry="60" fill="url(#halo2)" />
        <rect x="196" y="20" width="8" height="12" fill="#1a1320" />
        <circle cx="200" cy="16" r="9" fill="url(#knob)" />
        <path d="M52 132 C52 60 130 26 200 26 C270 26 348 60 348 132 Z" fill="url(#domeFill)" />
        <path d="M52 132 C52 60 130 26 200 26 C270 26 348 60 348 132 Z" fill="url(#ribsDark)" clipPath="url(#domeClip)" />
        <path d="M52 132 C52 60 130 26 200 26 C270 26 348 60 348 132 Z" fill="url(#domeSheen)" />
        <ellipse cx="200" cy="32" rx="34" ry="7" fill="#0a0710" />
        <path d="M50 132 L350 132 L346 166 Q200 178 54 166 Z" fill="url(#skirtGlow)" />
        <path d="M50 132 L350 132 L346 166 Q200 178 54 166 Z" fill="url(#ribsGlow)" />
        <path d="M50 132 L350 132 L346 166 Q200 178 54 166 Z" fill="url(#skirtSide)" />
        <path d="M50 132 L350 132" stroke="#0a0710" strokeWidth="3" />
        <path d="M54 166 Q200 178 346 166" fill="none" stroke="#f7d9a3" strokeWidth="2" opacity=".85" />
        <path d="M54 168 Q200 181 346 168" fill="none" stroke="#3a2416" strokeWidth="2.5" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element -- konumu SVG'ye yüzdeyle bağlı, ölçeklenmez */}
      <img className="lampMark" src="/brand/lamp-logo.png" alt="MAG" width={372} height={148} decoding="async" />
    </div>
  );
}

/* ---- Hüzme + havuz (opaklık Stage.render'dan: hero'da 1, dalışa doğru söner, kapanışta geri gelir) ---- */
export function HeroLights({ bind }: { bind: Bind }) {
  return (
    <div className="beam" ref={bind("beam")} aria-hidden="true">
      <div className="pool" />
    </div>
  );
}

/* ---- İsim: referansta değişimde opaklık 0'a düşer, 0.45×480 ms sonra geri gelir ---- */
export function HeroName({ l1, l2, k, bind }: { l1: string; l2: string; k: string; bind: Bind }) {
  const [dim, setDim] = useState(false);
  const first = useRef(true);
  const [txt, setTxt] = useState({ l1, l2 });
  useEffect(() => {
    if (first.current) {
      first.current = false;
      setTxt({ l1, l2 });
      return;
    }
    setDim(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => {
      setTxt({ l1, l2 });
      setDim(false);
    }, reduced ? 0 : 480 * 0.45);
    return () => window.clearTimeout(id);
  }, [k, l1, l2]);
  return (
    <section className="scene scHero" ref={bind("scHero")}>
      <div className="name">
        <h1 className="hname t" style={{ opacity: dim ? 0 : 1 }}>
          <div>{txt.l1}</div>
          {txt.l2 ? <div>{txt.l2}</div> : null}
        </h1>
      </div>
    </section>
  );
}

/* ---- Oklar: 56 px daire, kenarlarda clamp(12px,3vw,48px) ---- */
export function HeroNav({ bind, onPrev, onNext, prevAria, nextAria }: { bind: Bind; onPrev: () => void; onNext: () => void; prevAria: string; nextAria: string }) {
  return (
    <>
      <button
        type="button"
        className="nav arrow l prev"
        ref={bind("arrowL")}
        aria-label={prevAria}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        className="nav arrow r next"
        ref={bind("arrowR")}
        aria-label={nextAria}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  );
}

/* ---- İlerleme çubuğu + sayaç: dolgu genişliği 100/N %, sol (i/N)·100 %, .48 s ease ---- */
export function HeroBar({ index, count, bind }: { index: number; count: number; bind: Bind }) {
  return (
    <>
      <div className="bar" ref={bind("track")} aria-hidden="true">
        <i style={{ width: `${100 / count}%`, left: `${(index / count) * 100}%` }} />
      </div>
      <div className="counter" ref={bind("counter")} aria-hidden="true">
        {index + 1} / {count}
      </div>
    </>
  );
}

/* ---- Kart: siyah silüet (maske) + görsel (opaklık = parlaklık) + bulanık yansıma; referans yapı ----
   Karartma FİLTRE İLE DEĞİL: .sil siyah div görselle maskelenir, üstündeki .img'in opaklığı parlaklıktır.
   Konum (transform) ve parlaklık Stage.render'dan; --srcD/--srcM maske ve yansıma için (mobilde küçük kopya). */
export function Card({ id, name, focus, slot, ar, extra, meta, bind, hasImg, alt }: { id: HeroId; name: string; focus: boolean; slot: number; ar: number; extra?: ExtraCutouts; meta?: SliceMeta; bind: Bind; hasImg: boolean; alt: string }) {
  const st = CUTOUTS[id];
  const m = CUTOUTS_M[id];
  const ex = extra?.[id];
  const srcD = st?.src ?? ex?.src ?? "";
  const srcM = m?.src ?? ex?.srcM ?? srcD;
  const style = { "--srcD": `url(${srcD})`, "--srcM": `url(${srcM})`, "--ar": String(ar) } as React.CSSProperties;
  return (
    <div className={"item" + (focus ? " focus" : "") + (hasImg ? "" : " noimg")} ref={bind(`item${slot}`)} data-k={id} data-ar={ar} style={style}>
      {hasImg ? (
        <>
          <div className="sil" aria-hidden="true" />
          <picture>
            {srcM !== srcD ? <source media="(max-width: 899px)" srcSet={srcM} /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- cutout, unoptimized (alfa kenarları yeniden kodlanmasın) */}
            <img className="img" src={srcD} alt={alt} loading="eager" fetchPriority={focus ? "high" : "low"} decoding="async" draggable={false} ref={bind(`img${slot}`) as (el: HTMLImageElement | null) => void} />
          </picture>
          <div className="refl" aria-hidden="true">
            <div className="clip">
              <div className="rsil" />
              <div className="rimg" ref={bind(`rimg${slot}`)} />
            </div>
          </div>
          {meta ? <Slices id={id} meta={meta} bind={bind} /> : null}
        </>
      ) : (
        <div className="ph" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <span>{name}</span>
        </div>
      )}
    </div>
  );
}

export default function Hero({ bind, l1, l2, k, index, count, onPrev, onNext, prevAria, nextAria }: { bind: Bind; l1: string; l2: string; k: string; index: number; count: number; onPrev: () => void; onNext: () => void; prevAria: string; nextAria: string }) {
  return (
    <>
      <HeroLights bind={bind} />
      <Lamp bind={bind} />
      <HeroName l1={l1} l2={l2} k={k} bind={bind} />
      <HeroNav bind={bind} onPrev={onPrev} onNext={onNext} prevAria={prevAria} nextAria={nextAria} />
      <HeroBar index={index} count={count} bind={bind} />
    </>
  );
}
