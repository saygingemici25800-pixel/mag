"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Katman aşaması slotu — iddia bölümünde, ikon rayının solunda.
 * Kutu/çerçeve yok: görsel doğrudan sahnede yüzer, altında yumuşak elips gölge.
 * Görseller siyah zeminli (şeffaf değil) → `mix-blend-mode: screen` ile sahne zeminine kaynar.
 * Bu yüzden slot `.scene` (opacity'li) içinde DEĞİL, sahne kökünde durur: opacity yığın bağlamı
 * açıp karışımı keserdi.
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
