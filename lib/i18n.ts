import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import type { MenuItem } from "@/lib/menu";

export type Locale = "tr" | "en";
export const LOCALES: Locale[] = ["tr", "en"];
export const DEFAULT_LOCALE: Locale = "tr";
export type Messages = typeof tr;

export function isLocale(x: string | undefined): x is Locale {
  return x === "tr" || x === "en";
}
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return locale === "en" ? (en as unknown as Messages) : tr;
}
/** "/siparis" → tr: "/siparis", en: "/en/siparis" */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  if (locale === "tr") return p;
  return p === "/" ? "/en" : "/en" + p;
}
/** "/en/siparis" → "/siparis" */
export function stripLocale(pathname: string): string {
  if (pathname === "/en") return "/";
  return pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
}
export function otherLocale(l: Locale): Locale {
  return l === "tr" ? "en" : "tr";
}
export const OG_LOCALE: Record<Locale, string> = { tr: "tr_TR", en: "en_US" };

/** Ürün adı/açıklaması: EN'de messages'tan, yoksa menü verisinden (ürün adları çoğunlukla aynı kalır). */
export function itemName(t: Messages, m: Pick<MenuItem, "id" | "name">): string {
  return (t.menuName as Record<string, string>)[m.id] ?? m.name;
}
export function itemDesc(t: Messages, m: Pick<MenuItem, "id" | "desc">): string | undefined {
  return (t.menuDesc as Record<string, string>)[m.id] ?? m.desc;
}
