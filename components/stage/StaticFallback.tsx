import Image from "next/image";
import type { Messages } from "@/lib/i18n";
import { HERO_ITEMS } from "@/lib/menu";
import { SITE } from "@/lib/site";
import { CUTOUTS } from "./cutouts";

/** prefers-reduced-motion: scroll-driven sahne yerine statik kartlar (basit fallback). */
export default function StaticFallback({ t }: { t: Messages }) {
  return (
    <main className="mx-auto max-w-5xl px-5 pt-28 pb-24 text-cream">
      <section className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {HERO_ITEMS.map((m) => (
          <article key={m.id} className="flex flex-col gap-3">
            {CUTOUTS[m.id] ? (
              <Image src={CUTOUTS[m.id]!} alt={`${m.name} burger`} className="h-44 w-auto self-center object-contain" sizes="(max-width: 640px) 80vw, 320px" />
            ) : (
              <div className="grid h-44 place-items-center self-center rounded-2xl border border-cream/10 px-6 font-display text-3xl uppercase text-cream/30">{m.name}</div>
            )}
            <h2 className="font-display text-3xl uppercase leading-[.85] tracking-tight">{m.name}</h2>
            <p className="text-sm leading-relaxed text-dim">{m.desc}.</p>
            <p className="font-body text-[.62rem] uppercase tracking-[.2em] text-dim">{t.hero.sub}</p>
          </article>
        ))}
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-2">
        {t.claims.map((c) => (
          <article key={c.l1} className="flex flex-col gap-2">
            <span className="font-body text-[.6rem] uppercase tracking-[.1em] line-through text-dim">{c.no}</span>
            <h2 className="font-display text-3xl uppercase leading-[.85] tracking-tight">
              {c.l1} {c.l2}
            </h2>
            <p className="text-sm leading-relaxed text-dim">{c.d}</p>
          </article>
        ))}
      </section>

      <section className="mt-24">
        <h2 className="font-display text-4xl uppercase leading-[.85] tracking-tight">
          {t.faq.title[0]} {t.faq.title[1]}
        </h2>
        <ul className="mt-6 divide-y divide-cream/15 border-y border-cream/15">
          {t.faq.items.map((q) => (
            <li key={q} className="py-4 text-dim">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 flex flex-col items-center gap-4 text-center">
        <h2 className="font-display text-4xl uppercase leading-[.85] tracking-tight">
          {t.footer.title[0]} {t.footer.title[1]}
        </h2>
        <p className="text-dim">{t.footer.lead}</p>
        <p className="font-body text-[.6rem] uppercase tracking-[.14em] text-dim">{t.footer.copy}</p>
        <nav className="flex gap-6 font-body text-[.62rem] uppercase tracking-[.16em] text-dim">
          <a href={SITE.social.tiktok}>{t.footer.tiktok}</a>
          <a href={SITE.social.instagram}>{t.footer.instagram}</a>
        </nav>
      </footer>
    </main>
  );
}
