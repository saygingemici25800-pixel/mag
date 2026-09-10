import type { Metadata } from "next";
import { comfortaa, museo } from "@/lib/fonts";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Panel — MAG",
  robots: { index: false, follow: false },
  manifest: "/panel/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MAG Panel", statusBarStyle: "black-translucent" },
};
export { viewport } from "@/lib/seo";

/** Panel kök layout'u — chrome yok, TR. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${museo.variable} ${comfortaa.variable}`}>
      <body>{children}</body>
    </html>
  );
}
