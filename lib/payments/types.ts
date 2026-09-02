import type { Order } from "@/lib/orders";

export interface CheckoutResult {
  /** müşterinin yönlendirileceği ödeme sayfası */
  redirectUrl: string;
  /** sağlayıcı referansı — siparişe payment_ref olarak yazılır */
  ref: string;
}
export interface CallbackResult {
  orderId: string;
  status: "paid" | "failed";
  ref?: string;
}
export interface PaymentProvider {
  readonly name: "mock" | "iyzico";
  createCheckout(order: Order, ctx: { baseUrl: string }): Promise<CheckoutResult>;
  /** Sağlayıcının callback isteği (POST). İmza/doğrulama başarısızsa hata fırlatır. */
  handleCallback(req: Request): Promise<CallbackResult>;
}
