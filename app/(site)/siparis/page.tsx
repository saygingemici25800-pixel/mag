import type { Metadata } from "next";
import OrderPage from "@/components/order/OrderPage";

export const metadata: Metadata = { title: "Sipariş — MAG Street Food" };

/** SİPARİŞ — menü + sepet + teslimat (spec §6) */
export default function SiparisPage() {
  return <OrderPage />;
}
