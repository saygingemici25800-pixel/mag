"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { localePath, type Messages } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import type { Bind } from "./Arc";
import Faq from "./Faq";
import Testimonials from "./Testimonials";
import Hours from "@/components/chrome/Hours";

interface Props {
  t: Messages;
  bind: Bind;
}


/**
 * Metindeki belirli parçaları 700 ağırlıkla vurgular. Renk DEĞİŞMEZ.
 * Parçalar i18n'den gelir (footer.leadEmphasis) — bileşende dile özgü metin yok.
 * Aynı parça birden çok geçerse hepsi vurgulanır; parça bulunamazsa metin aynen kalır.
 */
function emphasize(text: string, parts: readonly string[]): ReactNode[] {
  let out: ReactNode[] = [text];
  for (const part of parts) {
    if (!part) continue;
    const next: ReactNode[] = [];
    for (const chunk of out) {
      if (typeof chunk !== "string") {
        next.push(chunk);
        continue;
      }
      const bits = chunk.split(part);
      bits.forEach((bit, i) => {
        if (i > 0) next.push(<b key={`${part}-${next.length}`}>{part}</b>);
        if (bit) next.push(bit);
      });
    }
    out = next;
  }
  return out;
}

/** Manifesto (ATEŞ VE ET) · SSS paneli (+ müşteri yorumları) · BİZE KATIL + telif + sosyal bar. */
export default function Outro({ t, bind }: Props) {
  const locale = useLocale();
  return (
    <>
      <section className="scene payoff scPay" ref={bind("scPay")} aria-hidden="true">
        <h2>
          {t.payoff[0]}
          <br />
          {t.payoff[1]}
        </h2>
      </section>

      <section className="panel scFaq" ref={bind("scFaq")}>
        <div className="panelInner" ref={bind("faqInner")}>
        <h2>
          {t.faq.title[0]}
          <br />
          {t.faq.title[1]}
        </h2>
        <Faq items={t.faq.items} />
        {/* MÜŞTERİ YORUMLARI — SSS'ten sonra, BİZE KATIL'dan önce. Ayrı bir panel değil:
            sahne segment haritası (stageMath S_DESKTOP) ve döngü bozulmasın diye SSS panelinin
            içinde akar, panelin mevcut geçiş animasyonuyla birlikte gelir. */}
        <Testimonials t={t} />
        </div>
      </section>

      <section className="panel foot scFoot" ref={bind("scFoot")}>
        <div className="panelInner" ref={bind("footInner")}>
        <div className="signup">
          <h2>
            {t.footer.title[0]}
            <br />
            {t.footer.title[1]}
          </h2>
          {/* 14 Eyl 2026: TERS BLOK — bölüm koyu zeminli, bu kutu açık zemin + koyu yazı.
              Göz buraya takılsın diye çevresindeki her şeyin tersi.
              Vurgulanacak parçalar i18n'den (footer.leadEmphasis) geliyor; bileşende
              dile gömülü metin YOK, renk değişmiyor yalnızca kalınlık 700. */}
          <p className="joinNote">{emphasize(t.footer.lead, t.footer.leadEmphasis)}</p>
          <div className="fauxinput">{t.footer.placeholder}</div>
          <div className="fauxbtn">{t.footer.cta}</div>
          <div className="legal">{t.footer.legal}</div>
        </div>
        {/* 12 Eyl 2026: çalışma saatleri footer'da da görünür (lib/hours.ts tek kaynak).
            compact: bugünün aralığı + "şu an açık/kapalı". */}
        <div className="foothours">
          <b>{t.contact.hoursTitle}</b>
          <Hours t={t.contact} variant="compact" />
        </div>
        <div className="copyline">{t.footer.copy}</div>
        </div>
        <nav className="socialbar" aria-label="Sosyal ve yasal">
          <a className="pill" href={SITE.social.tiktok}>
            {t.footer.tiktok}
          </a>
          <span className="links">
            {t.footer.links.map((l, i) => (
              <Link key={l} href={localePath(locale, `/yasal/${t.footer.linkSlugs[i]}`)} prefetch={false}>
                {l}
              </Link>
            ))}
          </span>
          <a className="pill" href={SITE.social.instagram}>
            {t.footer.instagram}
          </a>
        </nav>
      </section>
    </>
  );
}
