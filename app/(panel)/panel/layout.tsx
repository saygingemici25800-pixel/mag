import type { Metadata } from "next";
import { fontClass } from "@/lib/fonts";
import "@/app/globals.css";

export const metadata: Metadata = { title: "Panel — MAG", robots: { index: false, follow: false } };
export { viewport } from "@/lib/seo";

/** Panel kök layout'u — chrome yok, TR. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={fontClass}>
      <body>{children}</body>
    </html>
  );
}
