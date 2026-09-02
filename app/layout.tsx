import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono } from "next/font/google";
import { getMessages } from "@/lib/i18n";
import "./globals.css";

/* Archivo değişken font: 100–900 + italik. Display başlıklar 900 italic. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
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
