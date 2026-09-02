import { notFound } from "next/navigation";
import OrderTrack from "@/components/order/OrderTrack";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { getOrderStore } from "@/lib/store";

export const dynamic = "force-dynamic";
const t = getMessages("tr");
export const metadata = pageMetadata({ locale: "tr", path: "/siparis", title: t.track.metaTitle, noIndex: true });

/** Sipariş takip — sunucu ilk durumu okur, istemci SSE dinler. */
export default async function TrackPage({ params }: PageProps<"/siparis/[id]">) {
  const { id } = await params;
  const order = await getOrderStore().get(id);
  if (!order) notFound();
  return <OrderTrack initial={order} />;
}
