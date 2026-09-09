"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";
import { REEL_IMAGES, TESTIMONIALS } from "@/lib/testimonials";

/**
 * MÜŞTERİLER NE DİYOR — 21st.dev "scroll-reel-testimonials" deseninin bu siteye uyarlaması.
 * Saf React + Tailwind/CSS; harici paket YOK (headlessui'li slider alternatifi kullanılmadı).
 *
 * Üç dikey makara karşılıklı yönde döner (orta sütun ters), yanında yorum karakter karakter
 * yükselir. Referanstaki 121 px hücreler bu sahnede çok yer kaplıyordu: hücre 54 px
 * (mobilde 44 px) — bölüm SSS'in yaklaşık yarısı kadar dikey yer tutsun diye.
 *
 * PORTRE YOK: müşteri fotoğrafımız yok, sahte portre kullanmıyoruz. Öne çıkan karolarda
 * kendi ürün kesimlerimiz döner; aradaki dolgu hücreleri referanstaki gibi bulanık kalır.
 *
 * KARE SÜRESİ: makara yalnızca görünürken döner. IntersectionObserver bölüm ekrandan
 * çıkınca animasyonu durdurur (data-run="0" → animation-play-state: paused), böylece
 * sahnenin geri kalanında hiç kare maliyeti olmaz.
 *
 * prefers-reduced-motion: makara kaymaz, metin animasyonu yok, içerik sabit görünür.
 */
export default function Testimonials({ t }: { t: Messages }) {
  /* Veri boşsa bölüm HİÇ render edilmez (istenen davranış). */
  if (TESTIMONIALS.length === 0) return null;

  return <TestimonialsInner t={t} />;
}

/** Hook'lar erken return'den sonra çağrılmasın diye içerik ayrı bileşende. */
function TestimonialsInner({ t }: { t: Messages }) {
  const c = t.testimonials;
  const [i, setI] = useState(0);
  const [run, setRun] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* Görünürlük: bölüm ekranda değilken ne makara döner ne de yorum değişir.
     IntersectionObserver TEK BAŞINA yetmiyor — sahnede SSS paneli yerinde durup yalnızca
     opacity:0 oluyor (Stage.render). Ölçüm: sayfa sonunda (p=0.94+) panel görünmezken makara
     dönmeye devam ediyordu. Bu yüzden panelin opaklığı da izleniyor. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const panel = el.closest<HTMLElement>(".panel");
    let inView = false;
    const sync = () => {
      const visible = inView && (!panel || parseFloat(getComputedStyle(panel).opacity) > 0.05);
      setRun(visible);
    };
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting && e.intersectionRatio > 0.15; sync(); }, {
      threshold: [0, 0.15, 0.5],
    });
    io.observe(el);
    /* Panelin opaklığı her karede JS ile yazılıyor. MutationObserver yalnızca DEĞİŞİM anında
       tetikleniyor; kaydırma opaklık 0'ken durursa son bildirim kaçabiliyordu. Bu yüzden
       görünürken hafif bir yoklama var — yalnızca bölüm ekrandayken çalışır, ekrandan
       çıkınca IntersectionObserver zaten kapatıyor. */
    let raf = 0;
    const poll = () => { sync(); raf = requestAnimationFrame(poll); };
    const startPoll = () => { if (!raf) raf = requestAnimationFrame(poll); };
    const stopPoll = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const io2 = new IntersectionObserver(([e]) => (e.isIntersecting ? startPoll() : stopPoll()), { threshold: 0 });
    io2.observe(el);
    return () => { io.disconnect(); io2.disconnect(); stopPoll(); };
  }, []);

  /* Yorum sırası — yalnızca görünürken ilerler. */
  useEffect(() => {
    if (!run || TESTIMONIALS.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; /* sabit içerik: ilk yorum durur */
    const id = window.setInterval(() => setI((x) => (x + 1) % TESTIMONIALS.length), 4200);
    return () => window.clearInterval(id);
  }, [run]);

  const item = TESTIMONIALS[i];
  /* Karakter karakter yükselme: her harf kendi gecikmesiyle. Boşluklar &nbsp; ile korunur.
     Uzun yorumlarda gecikme tavanı var, yoksa son harf çok geç gelirdi. */
  const chars = [...item.quote];
  const step = Math.min(18, 900 / Math.max(chars.length, 1));

  return (
    <div className="tst" ref={rootRef} data-run={run ? "1" : "0"} data-testimonials>
      <div className="tst-head">
        {/* Başlık TEK satır: SSS başlığı gibi iki satıra bölünürse bölüm hedefin iki katına
            çıkıyor. Metin messages'ta iki parça kalır (çeviriler bozulmasın), burada boşlukla
            birleştirilir. */}
        <h3 className="tst-title">{c.title.join(" ")}</h3>
        <a className="tst-src" href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={c.sourceAria}>
          {c.source}
        </a>
      </div>

      <div className="tst-body">
        {/* ---- MAKARA: üç sütun, ortadaki ters yönde ---- */}
        <div className="tst-reel" aria-hidden="true">
          {[0, 1, 2].map((col) => (
            <div key={col} className={"tst-col" + (col === 1 ? " rev" : "")}>
              {/* iki kez basılır: kesintisiz döngü için (translateY(-50%)) */}
              <div className="tst-track">
                {[0, 1].map((dup) => (
                  <div className="tst-set" key={dup}>
                    {REEL_IMAGES.map((id, k) => (
                      <span key={`${dup}-${k}`} className="tst-cell">
                        {/* öne çıkan karo: kendi ürün fotoğrafımız */}
                        {(k + col) % 3 !== 1 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/assets/cut-m/${id}.webp`} alt="" width={34} height={34} loading="lazy" decoding="async" />
                        ) : (
                          /* dolgu hücresi: referanstaki gibi bulanık, içerik taşımaz */
                          <span className="tst-blur" />
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ---- YORUM ---- */}
        <figure className="tst-quote">
          {/* aria-live yok: 4 sn'de bir değişen metin ekran okuyucuyu boğar.
              Tam metin blockquote'ta zaten okunur; harf span'leri aria-hidden. */}
          <blockquote key={i}>
            <span className="sr-only">{item.quote}</span>
            <span className="tst-chars" aria-hidden="true" style={{ ["--n" as string]: chars.length }}>
              {chars.map((ch, k) => (
                <span key={k} className="tst-ch" style={{ animationDelay: `${(k * step).toFixed(0)}ms` }}>
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </span>
          </blockquote>
          <figcaption>{item.author}</figcaption>
        </figure>
      </div>

      {/* sıra göstergesi: hangi yorumda olduğumuz */}
      <div className="tst-dots" role="tablist" aria-label={c.source}>
        {TESTIMONIALS.map((tt, k) => (
          <button
            key={tt.author + k}
            type="button"
            role="tab"
            className={"tst-dot" + (k === i ? " on" : "")}
            aria-selected={k === i}
            aria-label={tt.author}
            onClick={() => setI(k)}
          />
        ))}
      </div>
    </div>
  );
}
