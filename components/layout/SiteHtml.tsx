import Chrome from "@/components/chrome/Chrome";
import { LocaleProvider } from "@/components/LocaleProvider";
import { FontPreload } from "@/components/layout/FontPreload";
import { getMessages, type Locale } from "@/lib/i18n";
import "@/app/globals.css";

/** Kök HTML — dil başına bir kök layout (app/(tr), app/(en)/en). <html lang> Türkçe İ/ı için de önemli. */
export default function SiteHtml({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = getMessages(locale);
  return (
    <html lang={locale}>
      <head>
        <FontPreload />
      </head>
      <body>
        <LocaleProvider locale={locale} messages={t}>
          <Chrome locale={locale} />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
