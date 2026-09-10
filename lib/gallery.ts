/**
 * Galeri duvarı — görsel listesi TEK KAYNAK. Bileşene gömülü liste yok.
 *
 * DURUM (10 Eyl 2026): elde 7 ham ürün fotoğrafı var, hedef 20-24. Duvar 5 görselle
 * çalışır kuruldu; foto geldikçe yalnızca bu dizi büyür, bileşen değişmez.
 *
 * Not: bu dosyadaki fotoğraflar "tabak/masa" çekimi değil, turuncu ışık zeminine
 * yerleştirilmiş ürün çekimleri (hero ile aynı kaynak). Saydam kesimler (public/urun)
 * BİLEREK kullanılmıyor: mor zeminde havada duruyormuş gibi görünüyorlar.
 *
 * ALT METİN: fotoğrafın içeriği tahmin EDİLMEZ. Hangi ürün olduğu dosya adından kesin
 * biliniyor, o yüzden alt metin üründen türetilir (alt anahtarı menü id'si). Ürünü
 * bilinmeyen bir kare eklenirse alt: undefined bırakılır ve ortak yedek metin kullanılır
 * (messages: gallery.altFallback).
 */
export interface GalleryPhoto {
  src: string;
  /** Kaynak genişlik/yükseklik — next/image için (CLS olmasın) */
  w: number;
  h: number;
  /** lib/menu.ts ürün id'si; alt metin bundan kurulur. Bilinmiyorsa boş bırak. */
  item?: string;
}

export const GALLERY: GalleryPhoto[] = [
  { src: "/urun/ham/smooky.jpg", w: 1536, h: 1024, item: "smooky" },
  { src: "/urun/ham/brisket.jpg", w: 1536, h: 1024, item: "brisket" },
  { src: "/urun/ham/berry.jpg", w: 1536, h: 1024, item: "berry" },
  { src: "/urun/ham/jalapeno.jpg", w: 1536, h: 1024, item: "jalapeno" },
  { src: "/urun/ham/caesar.jpg", w: 1536, h: 1024, item: "caesar" },
  /* 10 Eyl 2026: yeni gelen iki foto. Bunlar TABAK/MASA çekimi (diğer beşi turuncu
     ışık zeminine yerleştirilmiş ürün çekimi) — galeride ikisi de sorun değil. */
  { src: "/urun/ham/truffle.jpg", w: 1536, h: 1024, item: "truffle" },
  { src: "/urun/ham/orjinal.jpg", w: 1536, h: 1024, item: "orjinal" },
];

/** Izgara TABANI: gerçek sütun/satır sayısı çalışma zamanında ekrana göre büyütülür
    (bir kopya ekranı aşmalı, yoksa sarmalamada boşluk görünür). Dört kopya döşenir. */
export const COLS = 5;
export const ROWS = 3;
/** Bir kopyadaki karo sayısı */
export const TILES = COLS * ROWS;

/**
 * Karo sırası. Görsel sayısı karo sayısından AZ olduğu için (5 < 12) aynı foto kaçınılmaz
 * olarak tekrar eder; amaç tekrarın GÖRÜNÜR olmaması, yani yan yana/alt alta aynı karenin
 * denk gelmemesi.
 *
 * Formül: (x + r + copy·2) mod n — sütun, satır ve kopya farklı adımlarla kaydırılır.
 * ÖLÇÜLDÜ (5 sütun × 3 satır, 2×2 kopya = 10×6 karo): komşu çiftlerin %0'ı aynı foto,
 * yani hiçbir yönde iki komşu karo aynı değil. Katsayılar aramayla seçildi; ilk denenen
 * "i + copy·2 + satır" %39 veriyordu ve bir kopyanın her satırı birbirinin aynısıydı.
 * Sütun sayısı değişirse katsayılar YENİDEN doğrulanmalı (tests/e2e/galeri.mjs ölçüyor).
 */
export function tileIndex(copy: number, i: number, total: number, cols: number = COLS): number {
  const x = i % cols;
  const r = Math.floor(i / cols);
  return (x + r + copy * 2) % total;
}
