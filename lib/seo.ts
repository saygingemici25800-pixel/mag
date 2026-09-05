import type { Metadata, Viewport } from "next";
import { OG_LOCALE, getMessages, localePath, type Locale } from "@/lib/i18n";
import type { HeroId } from "@/lib/menu";
import { PALETTE } from "@/lib/palette";
import { SITE, siteUrl } from "@/lib/site";

export const viewport: Viewport = { themeColor: PALETTE.purpleDeep, colorScheme: "dark" };

/** Kök layout metadata'sı: title şablonu, metadataBase, varsayılan OG. */
export function baseMetadata(locale: Locale): Metadata {
  const t = getMessages(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.title, template: t.meta.template },
    description: t.meta.description,
    applicationName: SITE.name,
    openGraph: { siteName: SITE.name, type: "website", locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: true },
  };
}

interface PageMetaInput {
  locale: Locale;
  /** locale öneksiz yol, örn. "/siparis" */
  path: string;
  title: string;
  description?: string;
  ogItem?: HeroId;
  noIndex?: boolean;
}

/** Sayfa metadata'sı: canonical + hreflang (tr/en/x-default) + dinamik OG görseli (/api/og). */
export function pageMetadata({ locale, path, title, description, ogItem = "smooky", noIndex }: PageMetaInput): Metadata {
  const t = getMessages(locale);
  const desc = description ?? t.meta.description;
  const url = localePath(locale, path);
  const og = `/api/og?item=${ogItem}&locale=${locale}`;
  return {
    title,
    description: desc,
    alternates: {
      canonical: url,
      languages: { tr: localePath("tr", path), en: localePath("en", path), "x-default": localePath("tr", path) },
    },
    openGraph: {
      title: `${title} · ${SITE.name} ${SITE.city}`,
      description: desc,
      url,
      locale: OG_LOCALE[locale],
      images: [{ url: og, width: 1200, height: 630, alt: `${SITE.name} — ${title}` }],
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE.name}`, description: desc, images: [og] },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
