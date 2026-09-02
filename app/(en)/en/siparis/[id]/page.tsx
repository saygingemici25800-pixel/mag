import { notFound } from "next/navigation";
import OrderTrack from "@/components/order/OrderTrack";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { getOrderStore } from "@/lib/store";

export const dynamic = "force-dynamic";
const t = getMessages("en");
export const metadata = pageMetadata({ locale: "en", path: "/siparis", title: t.track.metaTitle, noIndex: true });

export default async function TrackPageEn({ params }: PageProps<"/en/siparis/[id]">) {
  const { id } = await params;
  const order = await getOrderStore().get(id);
  if (!order) notFound();
  return <OrderTrack initial={order} />;
}
