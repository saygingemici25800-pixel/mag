import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono } from "next/font/google";
import { getMessages } from "@/lib/i18n";
import "./globals.css";

/* Archivo (değişken): gövde 400, display 800/900 italik. Google değişken dosyayı stil başına tek dosya olarak verir;
   400/800/900 normal aynı dosya olduğundan CTA'daki 800 normal ek bayt getirmez. latin-ext Türkçe için şart, latin ASCII için. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  preload: false, // HUD etiketleri; bağlantıları CSS ve LCP görseline bırak
});

const t = getMessages("tr");

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
};

export const viewport: Viewport = {
  themeColor: "#0C0A08",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${archivo.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
