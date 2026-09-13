/**
 * Galeri duvarı — görsel listesi TEK KAYNAK. Bileşene gömülü liste yok.
 *
 * 13 Eyl 2026 — GALERİ SIFIRDAN KURULDU. Eski 24 karelik seçki kaldırıldı;
 * işletmenin çekim arşivinden (mag-foto/, 135 kare) YÜZ İÇERMEYEN 63 karenin
 * TAMAMI galeriye alındı. Dosyalar public/galeri/01..63.webp: uzun kenar 1200px,
 * WebP kalite 78 (ort. 62 KB/kare, toplam 3,8 MB).
 *
 * YÜZ POLİTİKASI — DEĞİŞMEDİ: arşivdeki 72 karede tanınabilir yüz var, hiçbiri
 * kullanılmadı. Liste docs/screens/galeri-onay/SECIM.md'de 71 kare olarak duruyordu;
 * bu turda 63 adayın HEPSİ tek tek yeniden görüntülendi ve IMG_8514'te (tezgâhta
 * profilden yüz) listede OLMAYAN bir yüz bulunup çıkarıldı. Kalan 63 karede yalnızca
 * el/gövde/saç var — kimlik belirlemiyor.
 *
 * PERFORMANS: duvar 4 kopya × ekrana göre ızgara basıyor, yani DOM'daki <img>
 * sayısı LİSTE UZUNLUĞUNA DEĞİL ekran boyutuna bağlı. Her karo loading="lazy" +
 * quality={70} + sizes ≤22vw; tarayıcı yalnızca ekranda görünen karoyu indiriyor.
 * Bu yüzden 24 → 63 kare geçişi ilk yükleme transferini artırmıyor (ölçüldü,
 * rapor commit mesajında). Liste uzadıkça tekrar AZALIYOR, maliyet artmıyor.
 *
 * ALT METİN: içerik tahmin EDİLMEZ. 63 karenin hepsi açılıp bakıldı; altKey ile
 * messages.gallery'deki üç dilli açıklamaya bağlanıyor (43 benzersiz açıklama —
 * aynı sahnenin varyasyonları aynı metni paylaşıyor).
 *
 * ORAN: kareler karışık (50 dikey, 13 yatay). Karo kutusu KARE ve object-fit:cover
 * — yani her kare merkezden kırpılıyor. Tek bir en-boy oranı dayatmak yatay kareleri
 * daha çok kırpardı; kırpma kutuda, kaynak dosyada değil (oran korunuyor).
 */
export interface GalleryPhoto {
  src: string;
  /** Kaynak genişlik/yükseklik — next/image için (CLS olmasın) */
  w: number;
  h: number;
  /** lib/menu.ts ürün id'si; alt metin bundan kurulur. Ürün karesi değilse boş. */
  item?: string;
  /** messages.gallery içindeki alt metin anahtarı. */
  altKey?: string;
}

/* Sıra dosya adı sırası (01..63) = arşiv sırası. Kaynak dosya adı yorumda. */
export const GALLERY: GalleryPhoto[] = [
  { src: "/galeri/01.webp", w: 800, h: 1200, altKey: "sign" }, // IMG_8432
  { src: "/galeri/02.webp", w: 800, h: 1200, altKey: "sign" }, // IMG_8433
  { src: "/galeri/03.webp", w: 800, h: 1200, altKey: "neon" }, // IMG_8437
  { src: "/galeri/04.webp", w: 800, h: 1200, altKey: "chalkboard" }, // IMG_8439
  { src: "/galeri/05.webp", w: 800, h: 1200, altKey: "burgerPan" }, // IMG_8442
  { src: "/galeri/06.webp", w: 1200, h: 800, altKey: "burgerPlate" }, // IMG_8463
  { src: "/galeri/07.webp", w: 1200, h: 800, altKey: "burgerFries" }, // IMG_8466
  { src: "/galeri/08.webp", w: 800, h: 1200, altKey: "burgerFriesEdge" }, // IMG_8476
  { src: "/galeri/09.webp", w: 800, h: 1200, altKey: "burgerFriesEdge" }, // IMG_8477
  { src: "/galeri/10.webp", w: 1200, h: 800, altKey: "burgerFries" }, // IMG_8483
  { src: "/galeri/11.webp", w: 800, h: 1200, altKey: "burgerFriesIndoor" }, // IMG_8495
  { src: "/galeri/12.webp", w: 800, h: 1200, altKey: "burgerServed" }, // IMG_8507
  { src: "/galeri/13.webp", w: 799, h: 1200, altKey: "burgerServed" }, // IMG_8510
  { src: "/galeri/14.webp", w: 800, h: 1200, altKey: "burgerCounter" }, // IMG_8521
  { src: "/galeri/15.webp", w: 1200, h: 800, altKey: "kitchenFry" }, // IMG_8523
  { src: "/galeri/16.webp", w: 800, h: 1200, altKey: "bagWalk" }, // IMG_8571
  { src: "/galeri/17.webp", w: 800, h: 1200, altKey: "bagWalk" }, // IMG_8574
  { src: "/galeri/18.webp", w: 800, h: 1200, altKey: "bagWalk" }, // IMG_8576
  { src: "/galeri/19.webp", w: 800, h: 1200, altKey: "bagHold" }, // IMG_8587
  { src: "/galeri/20.webp", w: 800, h: 1200, altKey: "bagHold" }, // IMG_8591
  { src: "/galeri/21.webp", w: 1200, h: 800, altKey: "burgerFries" }, // IMG_8619
  { src: "/galeri/22.webp", w: 1200, h: 800, altKey: "burgerFries" }, // IMG_8624
  { src: "/galeri/23.webp", w: 800, h: 1200, altKey: "burgerBucket" }, // IMG_8638
  { src: "/galeri/24.webp", w: 1200, h: 800, altKey: "burgerFries" }, // IMG_8642
  { src: "/galeri/25.webp", w: 800, h: 1200, altKey: "burgerLeaf" }, // IMG_8656
  { src: "/galeri/26.webp", w: 800, h: 1200, altKey: "handsBw" }, // IMG_8666
  { src: "/galeri/27.webp", w: 800, h: 1200, altKey: "handsWood" }, // IMG_8667
  { src: "/galeri/28.webp", w: 800, h: 1200, altKey: "tableHands" }, // IMG_8746
  { src: "/galeri/29.webp", w: 1200, h: 800, altKey: "burgerPlate" }, // IMG_8790
  { src: "/galeri/30.webp", w: 1200, h: 800, altKey: "burgerGreens" }, // IMG_8796
  { src: "/galeri/31.webp", w: 800, h: 1200, altKey: "burgerStreet" }, // IMG_8803
  { src: "/galeri/32.webp", w: 800, h: 1200, altKey: "burgerTable" }, // IMG_8806
  { src: "/galeri/33.webp", w: 1200, h: 800, altKey: "burgerWall" }, // IMG_8819
  { src: "/galeri/34.webp", w: 800, h: 1200, altKey: "burgerLogo" }, // IMG_8849
  { src: "/galeri/35.webp", w: 1200, h: 800, altKey: "citir" }, // IMG_8858
  { src: "/galeri/36.webp", w: 800, h: 1200, altKey: "citirFries" }, // IMG_8865
  { src: "/galeri/37.webp", w: 800, h: 1200, altKey: "serveWindow" }, // IMG_8875
  { src: "/galeri/38.webp", w: 800, h: 1200, altKey: "serveStack" }, // IMG_8888
  { src: "/galeri/39.webp", w: 800, h: 1200, altKey: "servePalm" }, // IMG_8891
  { src: "/galeri/40.webp", w: 1200, h: 800, altKey: "taco" }, // IMG_8932
  { src: "/galeri/41.webp", w: 800, h: 1200, altKey: "tacoLeaf" }, // IMG_8941
  { src: "/galeri/42.webp", w: 800, h: 1200, altKey: "tacoLeaf" }, // IMG_8944
  { src: "/galeri/43.webp", w: 800, h: 1200, altKey: "noodleLeaf" }, // IMG_8954
  { src: "/galeri/44.webp", w: 800, h: 1200, altKey: "noodleHold" }, // IMG_8958
  { src: "/galeri/45.webp", w: 800, h: 1200, altKey: "noodleHold" }, // IMG_8970
  { src: "/galeri/46.webp", w: 800, h: 1200, altKey: "friesBowl" }, // IMG_9004
  { src: "/galeri/47.webp", w: 800, h: 1200, altKey: "friesBowl" }, // IMG_9010
  { src: "/galeri/48.webp", w: 1200, h: 800, altKey: "citirTenders" }, // IMG_9021
  { src: "/galeri/49.webp", w: 800, h: 1200, altKey: "friesBowl" }, // IMG_9042
  { src: "/galeri/50.webp", w: 800, h: 1200, altKey: "tableSpread" }, // IMG_9106
  { src: "/galeri/51.webp", w: 800, h: 1200, altKey: "burgerFriesWood" }, // IMG_9107
  { src: "/galeri/52.webp", w: 800, h: 1200, altKey: "tableDrinks" }, // IMG_9109
  { src: "/galeri/53.webp", w: 800, h: 1200, altKey: "tableNoodle" }, // IMG_9115
  { src: "/galeri/54.webp", w: 800, h: 1200, altKey: "parmFries" }, // IMG_9122
  { src: "/galeri/55.webp", w: 800, h: 1200, altKey: "parmFries" }, // IMG_9132
  { src: "/galeri/56.webp", w: 800, h: 1200, altKey: "tableSpritz" }, // IMG_9142
  { src: "/galeri/57.webp", w: 800, h: 1200, altKey: "tableSpritz" }, // IMG_9144
  { src: "/galeri/58.webp", w: 800, h: 1200, altKey: "tacoLime" }, // IMG_9247
  { src: "/galeri/59.webp", w: 800, h: 1200, altKey: "tacoLime" }, // IMG_9251
  { src: "/galeri/60.webp", w: 800, h: 1200, altKey: "tacoLime" }, // IMG_9258
  { src: "/galeri/61.webp", w: 800, h: 1200, altKey: "dessert" }, // IMG_9334
  { src: "/galeri/62.webp", w: 800, h: 1200, altKey: "tacoTable" }, // IMG_9382
  { src: "/galeri/63.webp", w: 800, h: 1200, altKey: "tacoTable" }, // IMG_9387
]

/** Izgara TABANI: gerçek sütun/satır sayısı çalışma zamanında ekrana göre büyütülür
    (bir kopya ekranı aşmalı, yoksa sarmalamada boşluk görünür). Dört kopya döşenir. */
export const COLS = 5;
export const ROWS = 3;
/** Bir kopyadaki karo sayısı */
export const TILES = COLS * ROWS;

/**
 * Karo sırası. 63 görsel, bir kopyada 15 karo: artık liste karo sayısından ÇOK daha
 * uzun, yani bir ekranda aynı kare iki kez görünmüyor. Formül yine de duruyor çünkü
 * amaç değişmedi: komşu karolar aynı fotoğrafı göstermesin.
 *
 * Formül: (x + r + copy·2) mod n — sütun, satır ve kopya farklı adımlarla kaydırılır.
 * Sütun sayısı değişirse katsayılar YENİDEN doğrulanmalı (tests/e2e/galeri.mjs ölçüyor).
 */
export function tileIndex(copy: number, i: number, total: number, cols: number = COLS): number {
  const x = i % cols;
  const r = Math.floor(i / cols);
  return (x + r + copy * 2) % total;
}
