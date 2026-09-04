"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** açıklama paragrafı ile slot arasındaki boşluk (masaüstü) */
const GAP = 28;
/** masaüstünde slot kenarı */
const SIZE = 200;

interface Props {
  image?: string;
  /** dört iddia açıklaması — slot konumu en uzun olanına göre sabitlenir */
  descs?: string[];
}

/**
 * Katman aşaması slotu.
 *
 * Masaüstü: sol sütunda, açıklama paragrafının 28px altında, sol kenarı başlıkla hizalı.
 * `.left` dikey ortalanmış olduğu için alt kenarı metin uzunluğuyla oynar. Slot dört iddiada da
 * aynı yerde dursun diye konum, iddia metinlerinin **en uzunu** ölçülerek hesaplanır
 * (bottom-anchored); iddia değişince güncellenmez.
 *
 * Mobil: sağda, ikon rayının solunda — konum CSS'ten gelir.
 *
 * Kutu/çerçeve yok: şeffaf WebP doğrudan sahnede yüzer; arkasında çok hafif radyal karartma
 * (koyu köfte arkadaki ekmekle karışmasın), altında yumuşak elips gölge.
 * Slot `.scene` dışında, sahne kökünde durur ki sahnenin opacity'si görseli soldurmasın.
 */
export default function StageSlot({ image, descs }: Props) {
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

  /* masaüstü konumu: `.left`in x hizası + iddia metinlerinin en uzunundan gelen alt kenar */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /* dizi her render'da yeniden üretiliyor; efekt kimliğe değil içeriğe bağlansın */
  const descsKey = (descs ?? []).join("\u0000");
  /* Ölçülen en büyük alt kenar: slot dört iddiada da aynı yerde kalsın diye yalnızca büyür. */
  const maxBottom = useRef(0);
  useLayoutEffect(() => {
    maxBottom.current = 0;
  }, [descsKey]);

  useLayoutEffect(() => {
    const measure = () => {
      if (window.innerWidth < 900) {
        setPos(null); // mobilde konum CSS'ten gelir
        return;
      }
      const left = document.querySelector<HTMLElement>(".scDive .left");
      const p = left?.querySelector<HTMLElement>("p");
      if (!left || !p || !p.clientWidth) return;

      /* En uzun iddia paragrafını ölç: paragrafın kendisini değiştirmek yerine aynı yazı ve
         genişlik ayarlarına sahip, akış dışında gizli bir ölçüm kutusu kullanılır. */
      const cs = getComputedStyle(p);
      const probe = document.createElement("p");
      probe.style.cssText =
        `position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;margin:0;` +
        `font:${cs.font};letter-spacing:${cs.letterSpacing};line-height:${cs.lineHeight};` +
        `width:${p.clientWidth}px`;
      document.body.appendChild(probe);
      let maxP = p.offsetHeight;
      for (const d of descsKey ? descsKey.split("\u0000") : []) {
        probe.textContent = d;
        maxP = Math.max(maxP, probe.offsetHeight);
      }
      document.body.removeChild(probe);

      /* `.left` dikey ortalı: alt kenar = merkez + yükseklik/2 (yükseklik en uzun paragrafa göre).
         Ölçüm fontlar/metin geç oturduğunda büyüyebilir; en büyüğünü tutarız ki slot geri zıplamasın. */
      const h = left.offsetHeight - p.offsetHeight + maxP;
      const stageH = (left.offsetParent as HTMLElement | null)?.clientHeight ?? window.innerHeight;
      const bottom = stageH / 2 + h / 2;
      if (bottom <= maxBottom.current) return;
      maxBottom.current = bottom;
      setPos({ left: left.offsetLeft, top: Math.round(bottom + GAP) });
    };

    measure();
    /* Webfont'lar ve iddia metni geç oturur; her ikisinde de yeniden ölç. */
    document.fonts?.ready.then(measure).catch(() => {});
    const left = document.querySelector<HTMLElement>(".scDive .left");
    const ro = left ? new ResizeObserver(measure) : null;
    if (left && ro) ro.observe(left);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [descsKey]);

  if (!image) return null;
  return (
    <div
      className="stageSlot"
      aria-hidden="true"
      style={
        pos
          ? { left: pos.left, top: pos.top, right: "auto", translate: "0 0", width: SIZE, height: SIZE }
          : undefined
      }
    >
      {prev ? (
        // eslint-disable-next-line @next/next/no-img-element -- yol build'de doğrulanır, boyut CSS'te
        <img key={prev} className="out" src={prev} alt="" decoding="async" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- yol build'de doğrulanır, boyut CSS'te */}
      <img key={image} src={image} alt="" decoding="async" />
    </div>
  );
}
