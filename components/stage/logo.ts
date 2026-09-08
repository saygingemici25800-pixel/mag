/**
 * Preloader logosu — tam kilit (MAG. + STREET FOOD EST. 2025), krem.
 *
 * Tek dosya, kayıpsız WebP: logo düz renk + alfadan ibaret olduğu için 912 px kayıpsız sürüm
 * (~9 KB) küçültülmüş kayıplı türevlerden daha hafif — srcset'e gerek yok, her DPI'da keskin.
 * `node scripts/brand-derivatives.mjs` üretir. Kaynak: public/brand/mag-logo-cream.png.
 */
export const LOGO = {
  src: "/brand/mag-logo-cream.webp",
  width: 912,
  height: 434,
} as const;
