/** Ödeme sağlayıcı seçimi — PAYMENT_PROVIDER=mock | iyzico. Anahtar yoksa iyzico seçilemez (hata). */
import { isProduction } from "@/lib/env";
import { iyzicoProvider } from "./iyzico";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { CallbackResult, CheckoutResult, PaymentProvider } from "./types";

export function paymentProviderName(): "mock" | "iyzico" {
  const v = process.env.PAYMENT_PROVIDER;
  /* 16 Eyl 2026: mock sağlayıcı CANLIDA SEÇİLEMEZ. Yanlışlıkla
     PAYMENT_PROVIDER=mock production env'ine girerse sahte ödeme gerçek siparişi
     "ödendi" işaretler — para tahsil edilmeden sipariş mutfağa düşer. */
  if (v === "mock" && (process.env.VERCEL_ENV === "production" || process.env.MAG_ENV === "production")) {
    throw new Error("PAYMENT_PROVIDER=mock canlı ortamda kullanılamaz — production env'inden kaldırın");
  }
  if (v === "mock" || v === "iyzico") return v;
  if (!v && !isProduction()) return "mock"; // geliştirmede varsayılan
  throw new Error("PAYMENT_PROVIDER tanımsız (mock | iyzico)");
}
export function getPaymentProvider(): PaymentProvider {
  const name = paymentProviderName();
  if (name === "iyzico") {
    if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY) throw new Error("iyzico seçili ama IYZICO_API_KEY / IYZICO_SECRET_KEY yok");
    return iyzicoProvider;
  }
  return mockProvider;
}
