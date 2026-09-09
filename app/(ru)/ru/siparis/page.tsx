import OrderPage from "@/components/order/OrderPage";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("ru");
export const metadata = pageMetadata({ locale: "ru", path: "/siparis", title: t.order.metaTitle, description: t.order.metaDesc, ogItem: "brisket" });

export default function OrderPageRu() {
  return <OrderPage />;
}
