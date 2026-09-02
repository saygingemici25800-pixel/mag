"use client";

import { usePathname } from "next/navigation";
import { localePath, stripLocale, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
  labels: { tr: string; en: string; switchAria: string };
}

/** TR | EN — aynı sayfanın diğer dili. Kök layout değiştiği için tam sayfa yüklemesi (plain <a>). */
export default function LangSwitch({ locale, labels }: Props) {
  const path = stripLocale(usePathname() || "/");
  return (
    <nav className="lang" aria-label={labels.switchAria}>
      {(["tr", "en"] as Locale[]).map((l, i) => (
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
