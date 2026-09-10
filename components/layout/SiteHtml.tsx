import Chrome from "@/components/chrome/Chrome";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getMessages, type Locale } from "@/lib/i18n";
import { comfortaa, museo } from "@/lib/fonts";
import "@/app/globals.css";

/** Kök HTML — dil başına bir kök layout (app/(tr), app/(en)/en). <html lang> Türkçe İ/ı için de önemli. */
export default function SiteHtml({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = getMessages(locale);
  return (
    /* next/font sınıfları köke: değişkenler (--font-museo, --font-cyr) globals.css'te
       tek yığında kullanılıyor. Ön yükleme next/font tarafından otomatik yapılır. */
    <html lang={locale} className={`${museo.variable} ${comfortaa.variable}`}>
      <body>
        <LocaleProvider locale={locale} messages={t}>
          <Chrome locale={locale} />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
