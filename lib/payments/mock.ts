/**
 * MOCK sağlayıcı (PAYMENT_PROVIDER=mock): /odeme/test sayfasına yönlendirir; "Ödemeyi tamamla" / "Başarısız"
 * butonları callback'i HMAC imzasıyla çağırır — akış iyzico ile aynı (imza doğrulanır).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Order } from "@/lib/orders";
import type { CallbackResult, CheckoutResult, PaymentProvider } from "./types";

function secret(): string {
  return process.env.PAYMENT_MOCK_SECRET || process.env.PANEL_KEY || "mag-mock-dev-secret";
}
function hmac(msg: string): string {
  return createHmac("sha256", secret()).update(msg).digest("base64url");
}
function safeEq(a: string, b: string): boolean {
  const A = Buffer.from(a),
    B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

/** /odeme/test?ref=<orderId>.<sig> */
export function mockToken(orderId: string): string {
  return `${orderId}.${hmac("checkout:" + orderId)}`;
}
export function verifyMockToken(token: string | null): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const id = token.slice(0, i),
    sig = token.slice(i + 1);
  return safeEq(sig, hmac("checkout:" + id)) ? id : null;
}
/** Test sayfası formundaki gizli imza: HMAC(result:orderId:ok|fail) */
export function signResult(orderId: string, result: "ok" | "fail"): string {
  return hmac(`result:${orderId}:${result}`);
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(order: Order, ctx): Promise<CheckoutResult> {
    const ref = mockToken(order.id);
    return { redirectUrl: `${ctx.baseUrl}/odeme/test?ref=${encodeURIComponent(ref)}`, ref: "mock:" + ref.slice(-12) };
  },
  async handleCallback(req: Request): Promise<CallbackResult> {
    const form = await req.formData();
    const orderId = String(form.get("orderId") || "");
    const result = String(form.get("result") || "");
    const sig = String(form.get("sig") || "");
    if (!orderId || (result !== "ok" && result !== "fail")) throw new Error("mock callback: eksik alan");
    if (!safeEq(sig, signResult(orderId, result))) throw new Error("mock callback: imza geçersiz");
    return { orderId, status: result === "ok" ? "paid" : "failed", ref: "mock:" + result };
  },
};
