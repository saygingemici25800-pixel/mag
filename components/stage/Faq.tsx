"use client";

import { useState } from "react";
import type { Messages } from "@/lib/i18n";

/**
 * SSS akordiyonu.
 *
 * ÖNCEKİ HATA: sorular yalnızca metin <div>'iydi — tıklama işleyicisi, cevap alanı ve durum hiç
 * bağlanmamıştı, bu yüzden hiçbiri açılmıyordu (sahne katmanı ya da pointer-events sorunu değildi).
 *
 * Davranış: tıkla → açılır, tekrar tıkla → kapanır. Birden fazla soru aynı anda açık kalabilir.
 * Klavye: <button> olduğu için Tab ile gezilir, Enter/Space ile açılır; aria-expanded + aria-controls.
 * Açılma yüksekliği CSS grid-template-rows 0fr→1fr ile yumuşatılır (sabit yükseklik varsaymaz).
 */
export default function Faq({ items }: { items: Messages["faq"]["items"] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="faqlist">
      {items.map((it, i) => {
        const isOpen = open.has(i);
        return (
          <div key={it.q} className={"faqitem" + (isOpen ? " open" : "")} data-faq-item>
            <button
              type="button"
              className="faqq"
              aria-expanded={isOpen}
              aria-controls={`faq-a-${i}`}
              id={`faq-q-${i}`}
              onClick={() => toggle(i)}
              data-faq-toggle
            >
              <span>{it.q}</span>
              {/* + → × (açıkken 45° döner); dekoratif, durum aria-expanded'da */}
              <span className="faqsign" aria-hidden="true">
                +
              </span>
            </button>
            {/* hidden kullanılmaz: CSS geçişi çalışmaz. Kapalıyken grid satırı 0fr ve içerik
                inert (odaklanamaz, ekran okuyucuya kapalı) — açılış yumuşak kalır. */}
            <div className="faqa" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} inert={!isOpen} data-faq-answer data-open={isOpen}>
              <div className="faqa-in">
                <p>{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
