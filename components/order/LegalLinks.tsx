import Link from "next/link";
import { getMessages, localePath, type Locale } from "@/lib/i18n";
import { LEGAL_SLUGS } from "@/lib/legal";

/**
 * Sipariş ve ödeme sayfalarının altındaki yasal bağlantı şeridi.
 *
 * Mesafeli Sözleşmeler Yönetmeliği: tüketici sözleşme ve ön bilgilendirme
 * metinlerine sipariş sürecinde ERİŞEBİLMELİ. Ana sayfa footer'ında vardı ama
 * sipariş akışında yoktu; bu bileşen o boşluğu kapatıyor.
 *
 * Kaynak LEGAL_SLUGS — yeni yasal sayfa eklenince burası kendiliğinden günceller.
 */
export default function LegalLinks({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  return (
    <nav className="ord-legal" aria-label={t.legal.index} data-legal-links>
      {LEGAL_SLUGS.map((s) => (
        <Link key={s} href={localePath(locale, `/yasal/${s}`)} prefetch={false} data-legal-link={s}>
          {t.legal[s]}
        </Link>
      ))}
    </nav>
  );
}
