"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO } from "./logo";

/** gösterilen ilerleme = min(gerçek, geçen süre / MIN_MS): en az 2.4 s sürer */
const MIN_MS = 2400;
/** %100'de vurgu → bekleme → kalkış */
const POP_MS = 120;
const HOLD_MS = 350;
const FADE_MS = 600;

type Phase = "load" | "pop" | "leaving" | "gone";

interface Props {
  /** 0→1, gerçek yükleme adımları (fontlar, cutout decode, shader, ilk render) */
  progress: number;
  /** "YÜKLENİYOR · %{n}" — {n} her karede gösterilen ilerlemeyle değişir */
  label: string;
  /** preloader tamamen kalktı → sahne rAF'ı başlayabilir */
  onDone: () => void;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Açılış: MAG SAFE logosu iki katman. Alt katman bulanık/sönük (blur 16 → 0, brightness .55 → 1),
 * üst katman net ve tam renk, soldan sağa clip-path ile açılır; açılan kenarı 22 px'lik beyaz-pembe
 * ışık çizgisi takip eder. Gösterilen ilerleme gerçek ilerleme ile 2.4 s'lik zamanlayıcının yavaş
 * olanı. %100'de 120 ms vurgu (pembe + teal halo, 1 → 1.03 → 1), 350 ms bekleme, 600 ms fade +
 * yukarı kayış. Yalnızca ilk yüklemede; döngü sonunda tekrar gösterilmez.
 * Kare başına yazımlar React state'i değil, ref'ler üzerinden doğrudan DOM'a.
 */
export default function Preloader({ progress, label, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("load");
  const [reached, setReached] = useState(false);
  const doneCb = useRef(onDone);
  const real = useRef(0);
  useEffect(() => {
    doneCb.current = onDone;
  }, [onDone]);
  useEffect(() => {
    real.current = progress;
  }, [progress]);

  const root = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLImageElement>(null);
  const sharp = useRef<HTMLImageElement>(null);
  const fill = useRef<HTMLElement>(null);
  const num = useRef<HTMLDivElement>(null);

  /* her kare: shown = min(gerçek, geçen/2400) → DOM'a yaz */
  useEffect(() => {
    if (phase !== "load") return;
    const rm = reduced();
    /* reduced-motion: blur/wipe yok, logo 300 ms fade-in (WAAPI — global animation-duration
       override'ından etkilenmez) */
    if (rm && logo.current) logo.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "both" });
    const t0 = performance.now();
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      /* rAF zaman damgası kare başlangıcıdır, effect'teki t0'dan önce olabilir → 0'a kırp */
      const shown = Math.max(0, Math.min(real.current, (now - t0) / MIN_MS, 1));
      if (shown !== last) {
        last = shown;
        const pct = Math.round(shown * 100);
        root.current?.style.setProperty("--p", shown.toFixed(4));
        root.current?.setAttribute("aria-valuenow", String(pct));
        if (!rm) {
          if (base.current) base.current.style.filter = `blur(${(16 * (1 - shown)).toFixed(2)}px) brightness(${(0.55 + 0.45 * shown).toFixed(3)}) saturate(${(0.7 + 0.3 * shown).toFixed(3)})`;
          if (sharp.current) sharp.current.style.clipPath = `inset(0 ${((1 - shown) * 100).toFixed(3)}% 0 0)`;
        }
        if (fill.current) fill.current.style.transform = `scaleX(${shown.toFixed(4)})`;
        if (num.current) num.current.textContent = label.replace("{n}", String(pct));
      }
      if (shown >= 1) {
        setReached(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, label]);

  /* %100 → vurgu (120) → bekle (350) → kalk (600) */
  useEffect(() => {
    if (!reached) return;
    const timers = [
      window.setTimeout(() => setPhase("pop"), 0),
      window.setTimeout(() => setPhase("leaving"), POP_MS + HOLD_MS),
      window.setTimeout(() => {
        setPhase("gone");
        doneCb.current();
      }, POP_MS + HOLD_MS + FADE_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reached]);

  if (phase === "gone") return null;
  return (
    <div
      ref={root}
      className={"pre" + (phase === "leaving" ? " gone" : "") + (phase === "pop" ? " pop" : "")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-label={label.replace("{n}", "0")}
      aria-hidden={phase !== "load"}
    >
      <div className="preInner">
        <div ref={logo} className="preLogo">
          {/* alt katman: bulanık ve sönük başlar, ilerlemeyle netleşir */}
          {/* eslint-disable-next-line @next/next/no-img-element -- düz img; preload Stage'de */}
          <img ref={base} className="preBase" src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="" fetchPriority="high" decoding="async" />
          {/* üst katman: net ve tam renk, soldan sağa açılır */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={sharp} className="preSharp" src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="MAG SAFE" fetchPriority="high" decoding="async" />
        </div>
        <div className="preBar" aria-hidden="true">
          <i ref={fill} />
        </div>
        <div ref={num} className="preNum" aria-hidden="true">
          {label.replace("{n}", "0")}
        </div>
      </div>
    </div>
  );
}
