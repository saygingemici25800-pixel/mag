import tr from "@/messages/tr.json";

export type Locale = "tr" | "en";
export type Messages = typeof tr;

export const DEFAULT_LOCALE: Locale = "tr";

/** Faz 4'te `en.json` eklenecek; şimdilik her iki dil de TR'ye düşer. */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  void locale;
  return tr;
}
