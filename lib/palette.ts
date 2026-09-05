/**
 * Renk paletinin JS aynası — yalnızca CSS değişkenine erişemeyen yerler için
 * (theme-color meta, OG görseli, WebGL ışık rengi). KAYNAK app/globals.css :root;
 * buradaki değerler onunla birebir aynı olmalı (tests/e2e/palette.mjs denetler).
 */
export const PALETTE = {
  purple: "#422057",
  lime: "#FFD662",
  purpleDeep: "#1A0C22",
  purpleSoft: "#5A2E74",
  ink: "#1A0C22",
  /** "sıcak ada": burgerin arkasındaki ışığın ham tonu — CSS'te --mag-warm bunu mor-derinle karıştırır */
  warm: "#FF9636",
} as const;

/** "#rrggbb" → [r,g,b] 0..255 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
