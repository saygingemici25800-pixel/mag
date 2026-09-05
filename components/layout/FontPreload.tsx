import { preload } from "react-dom";

/**
 * Kritik iki yazı tipinin ön yüklemesi: Comico (başlıklar) + Bonny Regular (gövde).
 * Yüzler app/globals.css'te @font-face ile yerelden gelir; harici font bağlantısı yok.
 * react-dom preload(): <head>'e tek bir <link rel="preload" as="font" crossorigin> yazar
 * (elle <link> koyunca React aynı kaynağı ikinci kez hoist ediyordu → çift etiket).
 * Diğer Bonny ağırlıkları ilk kullanımda swap ile iner.
 */
export const CRITICAL_FONTS = ["/fonts/ComicoRegular.woff2", "/fonts/BonnyRegular.woff2"] as const;

export function FontPreload() {
  for (const href of CRITICAL_FONTS) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return null;
}
