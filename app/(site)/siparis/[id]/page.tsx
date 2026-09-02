import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OrderTrack from "@/components/order/OrderTrack";
import { getOrderStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sipariş takibi — MAG Street Food" };

/** Sipariş takip — sunucu ilk durumu okur, istemci yoklar. */
export default async function TrackPage({ params }: PageProps<"/siparis/[id]">) {
  const { id } = await params;
  const order = await getOrderStore().get(id);
  if (!order) notFound();
  return <OrderTrack initial={order} />;
}
