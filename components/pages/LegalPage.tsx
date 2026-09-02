import Link from "next/link";
import { getMessages, localePath, type Locale } from "@/lib/i18n";
import { LEGAL_SLUGS, legalDoc, type LegalSlug } from "@/lib/legal";
import "@/components/order/order.css";

/** /yasal/[slug] — şablon metin; EN'de Türkçe metin + İngilizce not. */
export default function LegalPage({ locale, slug }: { locale: Locale; slug: LegalSlug }) {
  const t = getMessages(locale);
  const doc = legalDoc(slug);
  return (
    <main className="ord">
      <div className="mx-auto max-w-3xl">
        <nav className="ord-label mb-6 flex flex-wrap gap-x-5 gap-y-2" aria-label={t.legal.index}>
          {LEGAL_SLUGS.map((s) => (
            <Link key={s} href={localePath(locale, `/yasal/${s}`)} className={s === slug ? "text-cream" : "hover:text-cream"} aria-current={s === slug ? "page" : undefined}>
              {t.legal[s]}
            </Link>
          ))}
        </nav>
        <h1 className="big in">
          <span>
            <i>{t.legal[slug]}</i>
          </span>
        </h1>
        <p className="ord-label mt-4">
          {t.legal.updated}: {doc.updated}
        </p>
        {locale === "en" ? <p className="mt-6 text-dim">{t.legal.trOnly}</p> : null}
        <p className="mt-2 text-sm text-dim">{t.legal.placeholderNote}</p>
        <article className="mt-8 flex flex-col gap-6 text-[1.02rem] leading-relaxed">
          {doc.sections.map((s, i) => (
            <section key={i} className="flex flex-col gap-3">
              {s.h ? <h2 className="ord-h">{s.h}</h2> : null}
              {s.p.map((p, j) => (
                <p key={j} className="m-0 text-cream/90">
                  {p.split(/(\[[A-Z_]+ — AÇIK\])/).map((part, k) =>
                    /^\[[A-Z_]+ — AÇIK\]$/.test(part) ? (
                      <mark key={k} className="rounded bg-kraft/25 px-1 text-kraft">
                        {part}
                      </mark>
                    ) : (
                      part
                    ),
                  )}
                </p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
