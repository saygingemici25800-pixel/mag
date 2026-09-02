/**
 * iyzico hosted checkout form (PAYMENT_PROVIDER=iyzico). Sandbox: https://sandbox-api.iyzipay.com
 * IYZICO_API_KEY / IYZICO_SECRET_KEY yoksa sağlayıcı seçilemez (lib/payments/index.ts hata verir).
 * Callback: iyzico callbackUrl'e POST ile `token` gönderir; sunucu checkoutForm.retrieve ile sonucu alır ve
 * yanıttaki `signature`'ı HMAC-SHA256(secretKey, "paymentId:currency:basketId:conversationId:paidPrice:price:token:paymentStatus")
 * ile doğrular. İmza gelmezse ya da eşleşmezse reddedilir. Alan sırası sandbox ile doğrulanacak — AÇIK.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import Iyzipay from "iyzipay";
import { getMessages, itemName } from "@/lib/i18n";
import { findMenuItem, type Order } from "@/lib/orders";
import { SITE } from "@/lib/site";
import type { CallbackResult, CheckoutResult, PaymentProvider } from "./types";

type IyziResult = Record<string, unknown> & { status?: string; errorMessage?: string };
type IyziCall = (req: object, cb: (err: unknown, res: IyziResult) => void) => void;
function call<T extends IyziResult>(fn: IyziCall, req: object): Promise<T> {
  return new Promise((resolve, reject) => fn(req, (err, res) => (err ? reject(err) : resolve(res as T))));
}
function client() {
  return new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || "",
    secretKey: process.env.IYZICO_SECRET_KEY || "",
    uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
  });
}
const money = (n: number) => n.toFixed(2);

export const iyzicoProvider: PaymentProvider = {
  name: "iyzico",
  async createCheckout(order: Order, ctx): Promise<CheckoutResult> {
    const t = getMessages(order.locale);
    const [first, ...rest] = order.name.split(" ");
    const address = order.address || SITE.address;
    const req = {
      locale: order.locale === "en" ? Iyzipay.LOCALE.EN : Iyzipay.LOCALE.TR,
      conversationId: order.id,
      price: money(order.subtotal + order.fee),
      paidPrice: money(order.total),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: order.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${ctx.baseUrl}/api/payments/callback`,
      enabledInstallments: [1],
      buyer: {
        id: order.phone,
        name: first || order.name,
        surname: rest.join(" ") || "-",
        gsmNumber: order.phone,
        email: `${order.phone.replace("+", "")}@musteri.magstreetfood.local`, // e-posta toplanmıyor
        identityNumber: "11111111111", // AÇIK: iyzico zorunlu alan; TCKN toplanmıyor
        registrationAddress: address,
        ip: "85.34.78.112",
        city: SITE.addressParts.locality,
        country: "Turkey",
      },
      shippingAddress: { contactName: order.name, city: SITE.addressParts.locality, country: "Turkey", address },
      billingAddress: { contactName: order.name, city: SITE.addressParts.locality, country: "Turkey", address },
      basketItems: [
        ...order.items.map((it) => {
          const m = findMenuItem(it.id);
          return { id: it.id, name: m ? itemName(t, m) : it.name, category1: "Yiyecek", itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL, price: money(it.price * it.qty) };
        }),
        ...(order.fee ? [{ id: "kurye", name: t.order.fee, category1: "Teslimat", itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL, price: money(order.fee) }] : []),
      ],
    };
    const c = client();
    const res = await call<IyziResult & { paymentPageUrl?: string; token?: string }>(c.checkoutFormInitialize.create.bind(c.checkoutFormInitialize), req);
    if (res.status !== "success" || !res.paymentPageUrl) throw new Error("iyzico initialize: " + (res.errorMessage || res.status));
    return { redirectUrl: res.paymentPageUrl, ref: "iyzico:" + (res.token || "") };
  },
  async handleCallback(req: Request): Promise<CallbackResult> {
    const form = await req.formData();
    const token = String(form.get("token") || "");
    if (!token) throw new Error("iyzico callback: token yok");
    const c = client();
    type Retrieve = IyziResult & { paymentStatus?: string; conversationId?: string; paymentId?: string; currency?: string; basketId?: string; paidPrice?: string; price?: string; signature?: string };
    const res = await call<Retrieve>(c.checkoutForm.retrieve.bind(c.checkoutForm), { locale: Iyzipay.LOCALE.TR, token });
    if (res.status !== "success") throw new Error("iyzico retrieve: " + (res.errorMessage || res.status));
    const msg = [res.paymentId, res.currency, res.basketId, res.conversationId, res.paidPrice, res.price, token, res.paymentStatus].join(":");
    const expected = createHmac("sha256", process.env.IYZICO_SECRET_KEY || "").update(msg).digest("hex");
    const got = String(res.signature || "");
    if (!got || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) throw new Error("iyzico callback: imza doğrulanamadı");
    const orderId = String(res.conversationId || "");
    if (!orderId) throw new Error("iyzico callback: conversationId yok");
    return { orderId, status: res.paymentStatus === "SUCCESS" ? "paid" : "failed", ref: "iyzico:" + token };
  },
};
