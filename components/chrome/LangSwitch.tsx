"use client";

import { usePathname } from "next/navigation";
import { LOCALES, localePath, stripLocale, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
  labels: Record<Locale, string> & { switchAria: string };
}

/** TR · EN · RU — aynı sayfanın diğer dilleri (yol korunur: /siparis → /ru/siparis).
    Kök layout dile göre değiştiği için tam sayfa yüklemesi (plain <a>). */
export default function LangSwitch({ locale, labels }: Props) {
  const path = stripLocale(usePathname() || "/");
  return (
    <nav className="lang" aria-label={labels.switchAria}>
      {LOCALES.map((l, i) => (
        <span key={l}>
          {i ? <i aria-hidden="true">|</i> : null}
          <a href={localePath(l, path)} hrefLang={l} lang={l} aria-current={l === locale ? "page" : undefined}>
            {labels[l]}
          </a>
        </span>
      ))}
    </nav>
  );
}
