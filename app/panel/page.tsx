import type { Metadata } from "next";
import PanelApp from "@/components/panel/PanelApp";
import "@/components/order/order.css";

export const metadata: Metadata = { title: "Panel — MAG", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** İşletme paneli — canlı sipariş akışı, ses, push (spec §7) */
export default function PanelPage() {
  return <PanelApp />;
}
