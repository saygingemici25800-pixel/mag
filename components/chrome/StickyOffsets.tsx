"use client";

import { useEffect } from "react";

/**
 * Sabit/yapışkan çubukların GERÇEK yüksekliğini ölçüp CSS değişkenine yazar.
 *
 * 14 Eyl 2026 — NEDEN: anchor ile bir bölüme gelindiğinde başlık üst barın altında
 * kalıyordu. Sebep, boşlukların SABİT SAYIYLA yazılmış olmasıydı:
 *   · /siparis bölümlerinde `scroll-mt-32` (128 px)
 *   · .chipsbar'da `top: 72px`
 * Oysa gerçek engel topbar'ın ALT KENARI (top 26 + yükseklik 44 = 70) ve onun
 * altındaki yapışkan çip çubuğu (alt kenar 132). Ölçüldü: mobilde başlık 50 px'e
 * oturuyor, yani 82 px kesiliyordu.
 *
 * Buradan yazılan değişkenler:
 *   --topbar-h    topbar'ın ALT KENARI (üstten uzaklık; top + height)
 *   --sticky-top  sayfadaki en alttaki yapışkan engelin alt kenarı
 *                 (/siparis'te çip çubuğu dahil, başka sayfalarda = --topbar-h)
 *
 * Ölçüm ResizeObserver + resize ile canlı tutulur: yazı tipi geç yüklenip bar
 * yüksekliği değişirse ya da ekran döndürülürse değer kendini günceller.
 * Sabit sayı YOK.
 */
export default function StickyOffsets() {
  useEffect(() => {
    const root = document.documentElement;

    const measure = () => {
      const bar = document.querySelector<HTMLElement>(".topbar");
      /* Alt kenar = üstten uzaklık + yükseklik. top:26 + h:44 → 70 */
      const barBottom = bar ? bar.getBoundingClientRect().height + (parseFloat(getComputedStyle(bar).top) || 0) : 0;

      /* Sayfada yapışkan bir çip çubuğu varsa gerçek engel odur. Sayfa henüz
         kaydırılmamışken de doğru olsun diye CSS `top` + yükseklik kullanılır,
         anlık getBoundingClientRect değil. */
      const chips = document.querySelector<HTMLElement>(".chipsbar");
      const chipsBottom = chips ? (parseFloat(getComputedStyle(chips).top) || 0) + chips.getBoundingClientRect().height : 0;

      root.style.setProperty("--topbar-h", `${Math.round(barBottom)}px`);
      root.style.setProperty("--sticky-top", `${Math.round(Math.max(barBottom, chipsBottom))}px`);
    };

    measure();
    const ro = new ResizeObserver(measure);
    const bar = document.querySelector(".topbar");
    const chips = document.querySelector(".chipsbar");
    if (bar) ro.observe(bar);
    if (chips) ro.observe(chips);
    window.addEventListener("resize", measure);
    /* yazı tipi geç gelirse bar yüksekliği değişebilir */
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return null;
}
