"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Katman aşaması slotu — iddia bölümünde, ikon rayının hemen solunda, rayla dikey hizalı.
 * Görseller şeffaf WebP: kutu/çerçeve yok, karışım normal — görsel doğrudan sahnede yüzer,
 * altında yumuşak elips gölge. Slot `.scene` dışında, sahne kökünde durur ki sahnenin
 * opacity'si aşama görselini soldurmasın.
 */
export default function StageSlot({ image }: { image?: string }) {
  /* aşama değişince eski görsel 350 ms daha durur (crossfade) */
  const [prev, setPrev] = useState<string | null>(null);
  const last = useRef(image);
  useEffect(() => {
    if (last.current === image) return;
    const old = last.current;
    last.current = image;
    if (!old) return;
    setPrev(old);
    const id = window.setTimeout(() => setPrev(null), 350);
    return () => window.clearTimeout(id);
  }, [image]);

  if (!image) return null;
  return (
    <div className="stageSlot" aria-hidden="true">
      {prev ? (
        // eslint-disable-next-line @next/next/no-img-element -- yol build'de doğrulanır, boyut CSS'te
        <img key={prev} className="out" src={prev} alt="" decoding="async" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- yol build'de doğrulanır, boyut CSS'te */}
      <img key={image} src={image} alt="" decoding="async" />
    </div>
  );
}
