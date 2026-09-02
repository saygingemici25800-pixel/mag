/** Ödeme sağlayıcı seçimi — PAYMENT_PROVIDER=mock | iyzico. Anahtar yoksa iyzico seçilemez (hata). */
import { isProduction } from "@/lib/env";
import { iyzicoProvider } from "./iyzico";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { CallbackResult, CheckoutResult, PaymentProvider } from "./types";

export function paymentProviderName(): "mock" | "iyzico" {
  const v = process.env.PAYMENT_PROVIDER;
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
