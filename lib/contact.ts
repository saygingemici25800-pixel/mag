/**
 * İletişim katmanının içeriği — TEK YERDEN düzenlenir.
 * AÇIK maddeler işletme onaylayınca doldurulur; null olanlar arayüzde yer tutucu metinle gösterilir.
 *
 * 12 Eyl 2026: telefon işletmeden geldi, AÇIK notu kaldırıldı. Çalışma saatleri bu
 * dosyadan çıkarıldı — lib/hours.ts tek kaynak (gün bazlı). Kalan AÇIK: tiktok,
 * walking süreleri.
 */
export const CONTACT = {
  address: "Cumhuriyet Mah. Atatürk Cd. No:24, 48300 Fethiye / Muğla",
  /** Google Haritalar yol tarifi — birebir bu URL (spec) */
  mapsUrl:
    "https://www.google.com/maps?client=safari&rls=en&oe=UTF-8&um=1&ie=UTF-8&fb=1&gl=tr&sa=X&geocode=KUkHsT2AQcAUMZbi0O5D2WjW&daddr=Cumhuriyet,+Atatürk+Cd.+No:24,+48303,+48000+Fethiye/Muğla",
  /** İşletmeden onaylı (12 Eyl 2026). tel: bağlantısı için boşluklar temizlenir. */
  phone: "0536 708 65 84",
  /** Uluslararası biçim — tel: bağlantısında bu kullanılır (mobilde arama açar). */
  phoneTel: "+905367086584",
  /* ÇALIŞMA SAATLERİ artık burada DEĞİL: lib/hours.ts tek kaynak (gün bazlı,
     açılış/kapanış dakika cinsinden). Arayüz saatleri oradan okur — burada
     kopyası tutulmaz ki ikisi ayrışmasın. */
  instagram: "https://www.instagram.com/magstreetfood/",
  /** AÇIK — TikTok hesabı; şimdilik yer tutucu */
  tiktok: null as string | null,
  /**
   * YÜRÜME MESAFESİ — 21 Eyl 2026: süreler ve liste İŞLETMEDEN GELDİ, artık
   * yer tutucu değil. Dizideki SIRA arayüzdeki sıradır (yakından uzağa).
   * `key` çeviri anahtarı: TR adı burada, EN/RU karşılıkları
   * messages/<dil>.json → contact.walkPlaces[key]. Anahtar yoksa TR adı görünür.
   */
  walking: [
    { key: "paspatur", place: "Paspatur Çarşısı", minutes: 1 },
    { key: "balikPazari", place: "Fethiye Balık Pazarı", minutes: 3 },
    { key: "ugurMumcu", place: "Uğur Mumcu Parkı / Sahil", minutes: 4 },
    { key: "eceMarina", place: "Ece Marina", minutes: 4 },
    { key: "muze", place: "Fethiye Müzesi", minutes: 5 },
  ],
} as const;
