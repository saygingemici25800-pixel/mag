/**
 * Galeri duvarı — görsel listesi TEK KAYNAK. Bileşene gömülü liste yok.
 *
 * DURUM (12 Eyl 2026): işletmenin çekim arşivinden (mag-foto/, 135 kare) 24 kare
 * seçildi ve kullanıcı onayladı. Hepsi public/galeri/ altına işlendi:
 * uzun kenar 1600px, WebP kalite 82. Ham arşiv .gitignore'da, repoya girmiyor.
 *
 * YÜZ POLİTİKASI: arşivdeki 71 karede tanınabilir yüz var, HİÇBİRİ kullanılmadı
 * (izinsiz kullanmıyoruz). Buradaki karelerde yalnızca el/gövde görünüyor —
 * kimlik belirlemiyor; altı tanesi tam boyutta ayrıca doğrulandı.
 *
 * ALT METİN: fotoğrafın içeriği tahmin EDİLMEZ. Kareler tek tek açılıp bakıldı.
 *  - Ürün karesi ise `item` verilir → alt metin menü adından kurulur (gallery.altOf).
 *  - Ürün olmayan kare (tabela, poşet, tezgâh, duvar işi) ise `altKey` verilir →
 *    messages.gallery[altKey] üç dilde yazılı. Böylece "MAG poşeti" karesine
 *    ürün adı uydurulmaz.
 *  - İkisi de yoksa ortak yedek (gallery.altFallback) kullanılır.
 */
export interface GalleryPhoto {
  src: string;
  /** Kaynak genişlik/yükseklik — next/image için (CLS olmasın) */
  w: number;
  h: number;
  /** lib/menu.ts ürün id'si; alt metin bundan kurulur. Ürün karesi değilse boş. */
  item?: string;
  /** messages.gallery içindeki alt metin anahtarı — ürün olmayan kareler için. */
  altKey?: string;
}

/* Sıra duvardaki sıradır: burger → çıtır → taco → noodle → yan ürün → mekân.
   Kaynak dosya adı yorumda, arşivde geri bulunabilsin diye. */
export const GALLERY: GalleryPhoto[] = [
  { src: "/galeri/01.webp", w: 1600, h: 1067, item: "orjinal" }, // IMG_8463 cheeseburger, siyah tabak
  { src: "/galeri/02.webp", w: 1600, h: 1067, item: "orjinal" }, // IMG_8483 cheeseburger + kovada patates
  { src: "/galeri/03.webp", w: 1600, h: 1066, item: "orjinal" }, // IMG_8790 cheeseburger, sarmaşık zemin
  { src: "/galeri/04.webp", w: 1600, h: 1067, item: "jalapeno" }, // IMG_8796 yeşillikli burger
  { src: "/galeri/05.webp", w: 1067, h: 1600, item: "caesar" }, // IMG_8803 marullu burger
  { src: "/galeri/06.webp", w: 1600, h: 1067, item: "brisket" }, // IMG_8819 burger, beyaz duvar
  { src: "/galeri/07.webp", w: 1600, h: 1067, item: "citir" }, // IMG_8858 Mag Çıtır
  { src: "/galeri/08.webp", w: 1067, h: 1600, item: "citir" }, // IMG_8865 çıtır, patates üstünde
  { src: "/galeri/09.webp", w: 1067, h: 1600, altKey: "sceneServe" }, // IMG_8875 elde servis
  { src: "/galeri/10.webp", w: 1067, h: 1600, altKey: "sceneLogo" }, // IMG_8849 duvardaki MAG logosu
  { src: "/galeri/11.webp", w: 1600, h: 1067, item: "smooky" }, // IMG_8619 burger + kovada patates
  { src: "/galeri/12.webp", w: 1600, h: 1067, item: "karides-taco" }, // IMG_8932 iki taco, metal stant
  { src: "/galeri/13.webp", w: 1067, h: 1600, altKey: "sceneLime" }, // IMG_9247 tacoya limon
  { src: "/galeri/14.webp", w: 1067, h: 1600, item: "tavuk-taco" }, // IMG_9251 taco yakın çekim
  { src: "/galeri/15.webp", w: 1067, h: 1600, item: "tavuklu-noodle" }, // IMG_8954 noodle kâsesi
  { src: "/galeri/16.webp", w: 1067, h: 1600, item: "tavuklu-noodle" }, // IMG_8958 noodle elde
  { src: "/galeri/17.webp", w: 1600, h: 1067, item: "citir" }, // IMG_9021 çıtır tavuk + sweet chili
  { src: "/galeri/18.webp", w: 1066, h: 1600, altKey: "sceneTable" }, // IMG_9115 noodle+taco+burger
  { src: "/galeri/19.webp", w: 1066, h: 1600, altKey: "sceneFries" }, // IMG_9042 kâsede patates, ekip
  { src: "/galeri/20.webp", w: 1066, h: 1600, altKey: "sceneParmesan" }, // IMG_9122 parmesanlı patates
  { src: "/galeri/21.webp", w: 1067, h: 1600, altKey: "sceneBag" }, // IMG_8587 kraft MAG poşeti
  { src: "/galeri/22.webp", w: 1067, h: 1600, altKey: "sceneHands" }, // IMG_8667 burger, bira, poşet
  { src: "/galeri/23.webp", w: 1067, h: 1600, altKey: "sceneSign" }, // IMG_8432 MAG tabelası
  { src: "/galeri/24.webp", w: 1067, h: 1600, altKey: "sceneWall" }, // IMG_8437 neon burger, duvar
];

/** Izgara TABANI: gerçek sütun/satır sayısı çalışma zamanında ekrana göre büyütülür
    (bir kopya ekranı aşmalı, yoksa sarmalamada boşluk görünür). Dört kopya döşenir. */
export const COLS = 5;
export const ROWS = 3;
/** Bir kopyadaki karo sayısı */
export const TILES = COLS * ROWS;

/**
 * Karo sırası. 12 Eyl 2026: görsel sayısı 7 → 24 oldu, artık karo sayısından (15) FAZLA;
 * yani tekrar zorunlu değil, her karo farklı foto alabiliyor. Formül aynı kaldı çünkü
 * amaç değişmedi: komşu karolar aynı fotoyu göstermesin.
 *
 * Formül: (x + r + copy·2) mod n — sütun, satır ve kopya farklı adımlarla kaydırılır.
 * ÖLÇÜLDÜ (5 sütun × 3 satır, 2×2 kopya = 10×6 karo): komşu çiftlerin %0'ı aynı foto.
 * Sütun sayısı değişirse katsayılar YENİDEN doğrulanmalı (tests/e2e/galeri.mjs ölçüyor).
 */
export function tileIndex(copy: number, i: number, total: number, cols: number = COLS): number {
  const x = i % cols;
  const r = Math.floor(i / cols);
  return (x + r + copy * 2) % total;
}
