import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import type { MenuItem } from "@/lib/menu";

export type Locale = "tr" | "en" | "ru";
export const LOCALES: Locale[] = ["tr", "en", "ru"];
export const DEFAULT_LOCALE: Locale = "tr";
export type Messages = typeof tr;

/** Varsayılan dilin yol öneki yoktur; diğerleri "/<kod>" ile başlar. */
const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export function isLocale(x: string | undefined): x is Locale {
  return LOCALES.includes(x as Locale);
}
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  if (locale === "en") return en as unknown as Messages;
  if (locale === "ru") return ru as unknown as Messages;
  return tr;
}
/** "/siparis" → tr: "/siparis", en: "/en/siparis", ru: "/ru/siparis" */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  if (locale === DEFAULT_LOCALE) return p;
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}
/** "/en/siparis" → "/siparis" · "/ru" → "/" */
export function stripLocale(pathname: string): string {
  for (const l of PREFIXED) {
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}
/** Yoldaki dil (yoksa varsayılan) — çerez/hatırlama ve hreflang için. */
export function localeFromPath(pathname: string): Locale {
  for (const l of PREFIXED) {
    if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return l;
  }
  return DEFAULT_LOCALE;
}
export const OG_LOCALE: Record<Locale, string> = { tr: "tr_TR", en: "en_US", ru: "ru_RU" };
/** <html lang> ve hreflang değeri. */
export const HTML_LANG: Record<Locale, string> = { tr: "tr", en: "en", ru: "ru" };

/** hreflang haritası: her dil + x-default (varsayılan dil). */
export function hreflangMap(path: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const l of LOCALES) m[HTML_LANG[l]] = localePath(l, path);
  m["x-default"] = localePath(DEFAULT_LOCALE, path);
  return m;
}

/**
 * Fiyat biçimi. Simge her dilde ₺ kalır, YERİ ve ayırıcı dile göre değişir:
 *  tr/en → "₺1.310"  ·  ru → "1 310 ₺" (Rusça'da simge sonda, binlik ayırıcı boşluk)
 * Boşluk KIRILMAZ (U+00A0): sayı ile simge satır sonunda ayrılmasın. Bazı tarayıcılar
 * ru-RU binlik ayırıcısı için dar boşluk (U+202F) üretir; onu da U+00A0 yapıyoruz ki
 * kare karşılaştırmalarında ve testte tek bir biçim olsun.
 */
export function formatPriceFor(locale: Locale, price: number): string {
  if (locale === "ru") return `${price.toLocaleString("ru-RU").replace(/ /g, " ")} ₺`;
  return `₺${price.toLocaleString("tr-TR")}`;
}

/**
 * Sepet çubuğundaki sayı animasyonu için parçalar (lib/cartFx.ts okur).
 * Animasyon her karede sayıyı yeniden yazdığı için simgenin yerini ve binlik ayırıcıyı
 * bilmek zorunda; formatPriceFor ile AYNI kuralı taşır.
 */
export function priceParts(locale: Locale): { "data-prefix"?: string; "data-suffix"?: string; "data-fmt": string } {
  if (locale === "ru") return { "data-suffix": " ₺", "data-fmt": "ru-RU" };
  return { "data-prefix": "₺", "data-fmt": "tr-TR" };
}

/** Ürün adı/açıklaması: çeviri varsa messages'tan, yoksa menü verisinden (ürün adları aynı kalır). */
export function itemName(t: Messages, m: Pick<MenuItem, "id" | "name">): string {
  return (t.menuName as Record<string, string>)[m.id] ?? m.name;
}
export function itemDesc(t: Messages, m: Pick<MenuItem, "id" | "desc">): string | undefined {
  return (t.menuDesc as Record<string, string>)[m.id] ?? m.desc;
}
/**
 * Malzeme adı çevirisi. Anahtar HER ZAMAN lib/menu.ts'teki Türkçe addır — sepet satır kimliği
 * (lineKey) ve sunucudaki beyaz liste bu ada dayanır, dolayısıyla çeviri yalnızca GÖSTERİMDE
 * kullanılır; veri tarafı Türkçe kalır.
 */
export function ingName(t: Messages, name: string): string {
  return (t.menuIng as Record<string, string>)[name] ?? name;
}
