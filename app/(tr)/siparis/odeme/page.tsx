import CheckoutPage from "@/components/order/CheckoutPage";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("tr");
export const metadata = pageMetadata({ locale: "tr", path: "/siparis/odeme", title: t.order.checkoutTitle[0] });

/** ÖDEME — sepet özeti, teslimat, bilgiler, ödemeye geç (yalnızca online) */
export default function CheckoutRoute() {
  return <CheckoutPage />;
}
