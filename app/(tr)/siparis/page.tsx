import OrderPage from "@/components/order/OrderPage";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("tr");
export const metadata = pageMetadata({ locale: "tr", path: "/siparis", title: t.order.metaTitle, description: t.order.metaDesc, ogItem: "brisket" });

/** SİPARİŞ — menü + sepet + teslimat (spec §6) */
export default function SiparisPage() {
  return <OrderPage />;
}
