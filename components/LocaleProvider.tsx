"use client";

import { createContext, useContext } from "react";
import { getMessages, type Locale, type Messages } from "@/lib/i18n";

const Ctx = createContext<{ locale: Locale; t: Messages }>({ locale: "tr", t: getMessages("tr") });

export function LocaleProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, t: messages }}>{children}</Ctx.Provider>;
}
export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
export function useT(): Messages {
  return useContext(Ctx).t;
}
