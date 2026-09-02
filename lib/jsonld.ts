/** schema.org: Restaurant + Menu/MenuItem (lib/menu.ts'ten). Ana sayfada JSON-LD olarak basılır. */
import { getMessages, itemDesc, itemName, localePath, type Locale } from "@/lib/i18n";
import { MENU, type Category } from "@/lib/menu";
import { SITE, siteUrl } from "@/lib/site";

const CATS: Category[] = ["burger", "taco", "noodle", "yan", "sos", "icecek"];

export function restaurantJsonLd(locale: Locale) {
  const t = getMessages(locale);
  const base = siteUrl();
  const url = base + localePath(locale, "/");
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": base + "/#restaurant",
    name: SITE.name,
    url,
    image: `${base}/api/og?item=smooky&locale=${locale}`,
    telephone: SITE.phoneE164,
    servesCuisine: "Burger",
    priceRange: "₺₺",
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.addressParts.street,
      addressLocality: SITE.addressParts.locality,
      addressRegion: SITE.addressParts.region,
      postalCode: SITE.addressParts.postalCode,
      addressCountry: SITE.addressParts.country,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: SITE.hours.open,
        closes: "23:59",
      },
    ],
    aggregateRating: { "@type": "AggregateRating", ratingValue: SITE.rating.value, reviewCount: SITE.rating.count },
    hasMenu: {
      "@type": "Menu",
      "@id": base + "/#menu",
      name: t.chrome.menu,
      url: base + localePath(locale, "/siparis"),
      inLanguage: locale,
      hasMenuSection: CATS.map((c) => ({
        "@type": "MenuSection",
        name: t.categories[c],
        hasMenuItem: MENU[c].map((m) => ({
          "@type": "MenuItem",
          name: itemName(t, m),
          ...(itemDesc(t, m) ? { description: itemDesc(t, m) } : {}),
          offers: { "@type": "Offer", price: m.price, priceCurrency: "TRY", availability: "https://schema.org/InStock" },
        })),
      })),
    },
    potentialAction: { "@type": "OrderAction", target: base + localePath(locale, "/siparis") },
  };
}
