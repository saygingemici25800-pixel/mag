"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroId } from "@/lib/menu";
import { CUTOUTS, CUTOUTS_M, type ExtraCutouts } from "./cutouts";
import type { Bind } from "./Arc";

/**
 * Hero görsel katmanı — docs/ref/hero/hero.html'in birebir React karşılığı.
 * Sayılar, gradyanlar ve SVG referanstan; tipografi sitenin MuseoModerno'su.
 * Kartların konumu Stage.render'dan (stageMath: hero pozu = referans carousel matematiği, offset'li tween);
 * burada yalnızca yapı ve durum (isim solup gelme, çubuk/sayaç).
 * Işık katmanı kontrol paneli (Armatür/Hüzme/Havuz/Yansıma anahtarları) bilerek yok.
 */

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

/* ---- Yan oklar: her yanda ÜÇ ince chevron (Ciao Energy dili) ----
   Eski 56 px daire butonlar KALDIRILDI: tek yönlendirme işareti kalsın.

   Konum: dikeyde odaktaki ürünün ortası (--arrowY), yatayda ürünün sınır kutusunun hemen
   dışında (--arrowGap). İkisi de Stage.render'dan her karede yazılır — sabit piksel yok,
   ürün/ekran boyutu değişince ok da kayar (stageMath: arrows.gap).

   Dokunma alanı 44 px (::before ile büyütülür), görsel işaret ~10 px kalır.
   Dalga: 2.4 sn'de bir içten dışa, her chevron 120 ms gecikmeli (CSS animation-delay).
   Yalnızca opacity + transform — filter YOK (kare maliyeti). */
function Chevrons({ dir }: { dir: -1 | 1 }) {
  /* d: sola bakan "‹", sağa bakan "›" — ince çizgi, küçük kutu */
  const d = dir < 0 ? "M7 2L3 6l4 4" : "M3 2l4 4-4 4";
  return (
    <>
      {[0, 1, 2].map((k) => (
        <svg key={k} className="chev" style={{ "--k": k } as React.CSSProperties} width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={d} />
        </svg>
      ))}
    </>
  );
}

export function HeroNav({ bind, onPrev, onNext, prevAria, nextAria }: { bind: Bind; onPrev: () => void; onNext: () => void; prevAria: string; nextAria: string }) {
  return (
    <>
      <button
        type="button"
        className="hnav l"
        ref={bind("arrowL")}
        aria-label={prevAria}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
      >
        <Chevrons dir={-1} />
      </button>
      <button
        type="button"
        className="hnav r"
        ref={bind("arrowR")}
        aria-label={nextAria}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        <Chevrons dir={1} />
      </button>
    </>
  );
}

/* ---- Aşağı ok: kaydırma ipucu ----
   Üç chevron alt alta, 4 sn'de bir yukarıdan aşağıya dalga (dalga ~1 sn, kalanı bekleme).
   Kullanıcı ilk kez kaydırınca KAYBOLUR ve bir daha görünmez. */
export function ScrollHint({ label }: { label: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (window.scrollY > 4) {
      setGone(true);
      return;
    }
    const on = () => {
      if (window.scrollY > 4) {
        setGone(true);
        window.removeEventListener("scroll", on);
      }
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (gone) return null;
  return (
    <div className="shint" aria-hidden="true" title={label}>
      {[0, 1, 2].map((k) => (
        <svg key={k} className="chev" style={{ "--k": k } as React.CSSProperties} width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2l4 4 4-4" />
        </svg>
      ))}
    </div>
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
export function Card({ id, name, focus, slot, ar, extra, bind, hasImg, alt }: { id: HeroId; name: string; focus: boolean; slot: number; ar: number; extra?: ExtraCutouts; bind: Bind; hasImg: boolean; alt: string }) {
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
        </>
      ) : (
        <div className="ph" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <span>{name}</span>
        </div>
      )}
    </div>
  );
}

export default function Hero({ bind, l1, l2, k, index, count, onPrev, onNext, prevAria, nextAria, scrollHint }: { bind: Bind; l1: string; l2: string; k: string; index: number; count: number; onPrev: () => void; onNext: () => void; prevAria: string; nextAria: string; scrollHint: string }) {
  return (
    <>
      <HeroName l1={l1} l2={l2} k={k} bind={bind} />
      <HeroNav bind={bind} onPrev={onPrev} onNext={onNext} prevAria={prevAria} nextAria={nextAria} />
      <HeroBar index={index} count={count} bind={bind} />
      <ScrollHint label={scrollHint} />
    </>
  );
}
