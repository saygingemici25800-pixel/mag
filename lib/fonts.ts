import { Archivo, DM_Mono } from "next/font/google";

/* Archivo (değişken): gövde 400, display 800/900 italik. Google değişken dosyayı stil başına tek dosya olarak verir;
   400/800/900 normal aynı dosya olduğundan CTA'daki 800 normal ek bayt getirmez. latin-ext Türkçe için şart.
   preload:false — HTTP/1.1'de bağlantıları CSS ve LCP görseline bırakır (Faz 1 ölçümü). */
export const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

export const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const fontClass = `${archivo.variable} ${dmMono.variable}`;
