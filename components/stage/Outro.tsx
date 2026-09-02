"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { localePath, type Messages } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import type { Bind } from "./Arc";

interface Props {
  t: Messages;
  bind: Bind;
}

/** Manifesto (ATEŞ VE ET) · SSS paneli · BİZE KATIL + telif + sosyal bar. */
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
        <h2>
          {t.faq.title[0]}
          <br />
          {t.faq.title[1]}
        </h2>
        <div className="faqlist">
          {t.faq.items.map((q, i) => (
            <div key={q} className={i === 0 ? "hot" : undefined}>
              <span>{q}</span>
              <span aria-hidden="true">+</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel foot scFoot" ref={bind("scFoot")}>
        <div className="signup">
          <h2>
            {t.footer.title[0]}
            <br />
            {t.footer.title[1]}
          </h2>
          <p>{t.footer.lead}</p>
          <div className="fauxinput">{t.footer.placeholder}</div>
          <div className="fauxbtn">{t.footer.cta}</div>
          <div className="legal">{t.footer.legal}</div>
        </div>
        <div className="copyline">{t.footer.copy}</div>
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
