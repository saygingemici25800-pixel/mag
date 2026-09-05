import { notFound } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import { formatPrice } from "@/lib/menu";
import { paymentProviderName } from "@/lib/payments";
import { signResult, verifyMockToken } from "@/lib/payments/mock";
import { getOrderStore } from "@/lib/store";
import "@/components/order/order.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test ödeme", robots: { index: false, follow: false } };

/** /odeme/test?ref=… — MOCK sağlayıcının ödeme sayfası. Butonlar callback'i HMAC imzalı form ile çağırır. */
export default async function MockPaymentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let name: "mock" | "iyzico";
  try {
    name = paymentProviderName();
  } catch {
    notFound();
  }
  if (name !== "mock") notFound();
  const { ref } = await searchParams;
  const orderId = verifyMockToken(typeof ref === "string" ? ref : null);
  if (!orderId) notFound();
  const order = await getOrderStore().get(orderId);
  if (!order) notFound();
  const t = getMessages(order.locale);
  const m = t.payment.mock;
  return (
    <main className="ord flex items-center">
      <div className="mx-auto w-full max-w-md">
        <div className="ord-label">
          {m.order} · {orderId.slice(0, 8).toUpperCase()}
        </div>
        <h1 className="big in mt-4">
          <span>
            <i>{m.title[0]}</i>
          </span>
          <span>
            <i>{m.title[1]}</i>
          </span>
        </h1>
        <p className="mt-5 text-dim">{m.lead}</p>
        <div className="mt-6 flex justify-between border-y border-cream/15 py-4 font-display">
          <span>{m.amount}</span>
          <b>{formatPrice(order.total)}</b>
        </div>
        <div className="mt-6 flex flex-col gap-3" data-mock-payment>
          <form method="post" action="/api/payments/callback">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="result" value="ok" />
            <input type="hidden" name="sig" value={signResult(orderId, "ok")} />
            <button type="submit" className="submit">
              {m.ok}
            </button>
          </form>
          <form method="post" action="/api/payments/callback">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="result" value="fail" />
            <input type="hidden" name="sig" value={signResult(orderId, "fail")} />
            <button type="submit" className="addbtn w-full">
              {m.fail}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
