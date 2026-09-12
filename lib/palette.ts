/**
 * Renk paletinin JS aynası — yalnızca CSS değişkenine erişemeyen yerler için
 * (theme-color meta, OG görseli, WebGL ışık rengi). KAYNAK app/globals.css :root;
 * buradaki değerler onunla birebir aynı olmalı (tests/e2e/palette.mjs denetler).
 *
 * 12 Eyl 2026: mor/limon palet KALDIRILDI, yerine kırmızı/sarı/gri geldi.
 */
export const PALETTE = {
  /** ana renk (~%60) */
  red: "#C72D1B",
  /** vurgu (~%30) */
  yellow: "#FDD20E",
  /** açık sıcak gri — gövde metni (~%10) */
  grey: "#E7E2DA",
  /** koyu yüzey: kart, ayırıcı, bölüm zemini */
  redDeep: "#7A1B10",
  /** sahne zemini — kırmızıdan türemiş, neredeyse siyah */
  ink: "#2A0906",
  /** kırmızı üzerindeki yazı */
  onRed: "#FDD20E",
  /** sarı üzerindeki yazı */
  onYellow: "#2A0906",
  /** "sıcak ada": burgerin arkasındaki ışığın ham tonu — CSS'te --mag-warm bunu ink ile karıştırır */
  warm: "#FF9636",
} as const;

/** "#rrggbb" → [r,g,b] 0..255 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
