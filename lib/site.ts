/** Site geneli sabitler. AÇIK maddeler işletmeden gelince doldurulacak. */
export const SITE = {
  name: "MAG Street Food",
  shortName: "MAG",
  city: "Fethiye",
  address: "Cumhuriyet Mah. Atatürk Cd. No:24, Fethiye",
  addressParts: { street: "Cumhuriyet Mah. Atatürk Cd. No:24", locality: "Fethiye", region: "Muğla", postalCode: "48300", country: "TR" },
  phoneDisplay: "0536 708 65 84",
  phoneE164: "+905367086584",
  /** AÇIK (spec §11.2): açılış saati onayı */
  hours: { open: "11:00", close: "00:00" },
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("MAG Street Food Cumhuriyet Mah. Atatürk Cd. No:24 Fethiye"),
  /** Instagram gerçek; TikTok AÇIK (spec §11.5) — yer tutucu */
  social: {
    tiktok: "https://www.tiktok.com/@magstreetfood",
    instagram: "https://www.instagram.com/magstreetfood/",
  },
  rating: { value: 4.6, count: 535 },
} as const;

/** Mutlak URL tabanı (metadataBase, sitemap, OG). Vercel'de NEXT_PUBLIC_SITE_URL; yoksa yerel. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
