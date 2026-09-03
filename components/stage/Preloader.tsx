"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO } from "./logo";

/** %100'de vurgu (halo + hafif büyüme), sonra bekleme, sonra kalkış */
const POP_MS = 120;
const HOLD_MS = 350;
const FADE_MS = 600;

type Phase = "load" | "pop" | "leaving" | "gone";

interface Props {
  /** 0→1, gerçek yükleme adımlarına bağlı */
  progress: number;
  /** yükleme uzun sürdü → yüzdeyi göster */
  slow: boolean;
  /** preloader tamamen kalktı → sahne rAF'ı başlayabilir */
  onDone: () => void;
}

/**
 * Açılış: MAG SAFE logosu. İlerleme gerçek adımlardan gelir (zamanlayıcı değil).
 * Logo soluk başlar (brightness .35 / saturate .6) ve ilerlemeyle tam renge çıkar;
 * üstünde logo şekline maskelenmiş bir ışık süpürgesi soldan sağa geçer.
 * Yalnızca ilk yüklemede oynar; döngü sonunda (p=1 → 0) tekrar gösterilmez.
 */
export default function Preloader({ progress, slow, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("load");
  const doneCb = useRef(onDone);
  useEffect(() => {
    doneCb.current = onDone;
  }, [onDone]);

  // %100 → vurgu → bekle → kalk
  useEffect(() => {
    if (progress < 1) return;
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => setPhase("pop"), 0),
      window.setTimeout(() => setPhase("leaving"), POP_MS + HOLD_MS),
      window.setTimeout(() => {
        setPhase("gone");
        doneCb.current();
      }, POP_MS + HOLD_MS + FADE_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [progress]);

  if (phase === "gone") return null;

  const pct = Math.round(progress * 100);
  // süpürge: %0'da sol dışarıda (-40%), %100'de sağ dışarıda (140%)
  const sweep = -40 + progress * 180;
  const leaving = phase === "leaving";

  return (
    <div
      className={"pre" + (leaving ? " gone" : "") + (phase === "pop" ? " pop" : "")}
      style={{ "--p": progress, "--sweep": `${sweep}%` } as React.CSSProperties}
      aria-hidden={phase !== "load"}
      role="status"
      aria-label={`Yükleniyor ${pct}%`}
    >
      <div className="preInner">
        <div className="preLogo">
          {/* düz <img> — next/image değil; preload Stage'de react-dom preload() ile */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="MAG SAFE" fetchPriority="high" decoding="async" />
          <span className="preSweep" aria-hidden="true" />
        </div>
        <div className="preNum" style={{ opacity: slow ? 0.55 : 0 }}>
          {pct}%
        </div>
      </div>
    </div>
  );
}
