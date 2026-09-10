import { Comfortaa, MuseoModerno } from "next/font/google";

/**
 * TEK YAZI TİPİ: MuseoModerno (değişken). Comico ve Bonny tamamen kaldırıldı.
 * Ayrım aile ile değil, KALINLIK ile yapılır:
 *   700/800 → başlık ve vurgu (ürün adları, iddia başlıkları, buton, fiyat)
 *   500     → arayüz ve orta önem (menü satırı, sepet kalemi, form etiketi, panel)
 *   300/400 → gövde (açıklama, SSS cevabı, footer, yasal)
 *
 * next/font/google derleme sırasında yüzleri indirip KENDİ sunucumuzdan servis eder;
 * çalışma zamanında fonts.googleapis/gstatic'e istek GİTMEZ (mevcut "harici istek yok"
 * testi bunu doğruluyor).
 */
export const museo = MuseoModerno({
  subsets: ["latin", "latin-ext"], // latin-ext: Türkçe ç ğ ı İ ö ş ü için ŞART
  weight: ["300", "400", "500", "700", "800"],
  display: "swap",
  variable: "--font-museo",
  /* fallback VERİLMEZ: next/font bunu değişkenin İÇİNE yazıyor ve yığın
     "MuseoModerno, system-ui, sans-serif, Comfortaa..." oluyordu — Kiril, Comfortaa'ya
     ulaşamadan sistem fontuna düşüyordu (ölçüldü). Sıralama globals.css'te kurulur. */
  adjustFontFallback: false,
});

/**
 * KİRİL YEDEĞİ — Comfortaa.
 *
 * NEDEN GEREKLİ: MuseoModerno'nun alt kümeleri latin, latin-ext ve vietnamese; KİRİL YOK
 * (Google Fonts API'sinden doğrulandı). Yedek olmadan Rusça sayfalarda kutu karakter çıkar.
 *
 * NEDEN COMFORTAA: MuseoModerno gibi YUVARLAK GEOMETRİK bir display ailesi — tek katlı
 * harf yapısı, düşük kontrast, geniş yuvarlak sayaçlar. Denenen alternatifler arasında
 * (Nunito, Jost, Unbounded, Rubik) MuseoModerno'nun yuvarlaklığını taşıyan tek aile bu;
 * Nunito daha konvansiyonel, Jost ve Rubik fazla dik/mekanik, Unbounded aşırı geniş.
 * İkisi de OFL-1.1 ve değişken.
 *
 * TR/EN GÖRÜNÜMÜ DEĞİŞMEZ: yığında MuseoModerno ÖNCE gelir; Latin harfler ondan çizilir,
 * tarayıcı yalnızca MuseoModerno'da olmayan Kiril harfler için Comfortaa'ya düşer.
 */
export const comfortaa = Comfortaa({
  subsets: ["cyrillic", "latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
  variable: "--font-cyr",
  adjustFontFallback: false,
});
