/**
 * Yasal sayfalar — tek kaynak. Metinlerdeki {{ALAN}} yer tutucuları buradan dolar;
 * değeri null olanlar AÇIK'tır (işletmeden gelecek) ve sayfada [ALAN — AÇIK] olarak görünür.
 */
import { SITE, siteUrl } from "@/lib/site";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal-texts";

export const LEGAL_SLUGS = ["kvkk", "mesafeli-satis", "iade-iptal", "cerez"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
export function isLegalSlug(s: string): s is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(s);
}

/** null → AÇIK (spec §11.7) */
export const LEGAL_FIELDS: Record<string, string | null> = {
  UNVAN: null, // AÇIK: işletme unvanı (ör. "… Gıda Ltd. Şti.")
  VERGI_DAIRESI: null, // AÇIK
  VERGI_NO: null, // AÇIK
  MERSIS: null, // AÇIK (şahıs işletmesiyse yok)
  EPOSTA: null, // AÇIK: KVKK başvuru e-postası
  ADRES: SITE.address,
  TEL: SITE.phoneDisplay,
  MARKA: SITE.name,
  WEB: siteUrl().replace(/^https?:\/\//, ""),
  SAATLER: `${SITE.hours.open}–${SITE.hours.close}`,
  TARIH: "2026-09-03",
};

export function fillLegal(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = LEGAL_FIELDS[k];
    return v ?? `[${k} — AÇIK]`;
  });
}

export function legalDoc(slug: LegalSlug): LegalDoc {
  const d = LEGAL_DOCS[slug];
  return { ...d, sections: d.sections.map((s) => ({ h: s.h ? fillLegal(s.h) : undefined, p: s.p.map(fillLegal) })) };
}
