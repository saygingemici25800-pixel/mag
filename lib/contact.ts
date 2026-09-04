/**
 * İletişim katmanının içeriği — TEK YERDEN düzenlenir.
 * AÇIK maddeler işletme onaylayınca doldurulur; null olanlar arayüzde yer tutucu metinle gösterilir.
 */
export const CONTACT = {
  address: "Cumhuriyet Mah. Atatürk Cd. No:24, 48300 Fethiye / Muğla",
  /** Google Haritalar yol tarifi — birebir bu URL (spec) */
  mapsUrl:
    "https://www.google.com/maps?client=safari&rls=en&oe=UTF-8&um=1&ie=UTF-8&fb=1&gl=tr&sa=X&geocode=KUkHsT2AQcAUMZbi0O5D2WjW&daddr=Cumhuriyet,+Atatürk+Cd.+No:24,+48303,+48000+Fethiye/Muğla",
  /** AÇIK — işletme verecek; şimdilik yer tutucu */
  phone: null as string | null,
  /** AÇIK — çalışma saatleri; şimdilik yer tutucu */
  hours: null as string | null,
  instagram: "https://www.instagram.com/magstreetfood/",
  /** AÇIK — TikTok hesabı; şimdilik yer tutucu */
  tiktok: null as string | null,
  /**
   * YÜRÜME MESAFESİ — süreler AÇIK / YER TUTUCU: işletme onaylayınca güncellenecek.
   * Sıra arayüzdeki sıradır.
   */
  walking: [
    { place: "Fethiye Balık Pazarı", minutes: 4 },
    { place: "Uğur Mumcu Parkı / Sahil", minutes: 3 },
    { place: "Fethiye Müzesi", minutes: 7 },
    { place: "Ece Marina", minutes: 9 },
  ],
} as const;
