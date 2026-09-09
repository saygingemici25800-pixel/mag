/**
 * Google Haritalar'daki gerçek müşteri yorumlarından alınmıştır. Metinler değiştirilmez,
 * yeni yorum eklenmez.
 *
 * Diller: yorum METNİ üç dilde de TÜRKÇE kalır — gerçek bir kişinin sözünü çevirip ona
 * atfetmiyoruz. Yalnızca bölüm başlığı ve "Google Haritalar yorumları" satırı çevrilir
 * (messages/*.json → testimonials).
 *
 * Dizi boşsa bölüm hiç render edilmez (components/stage/Testimonials.tsx).
 */
export interface Testimonial {
  quote: string;
  author: string;
}

export const TESTIMONIALS: Testimonial[] = [
  { quote: "Dalaman'dan Fethiye'ye bu hamburgerleri yemek için gittim ve hiç pişman etmediler.", author: "Yunus Emre Karcı" },
  { quote: "Mag Berry ve Mag Classic yedik, ikisi de çok lezzetliydi. İşletmecileri çok ilgililer ve işlerine çok hakimler. Kesinlikle tavsiye ederiz.", author: "Esra Bülbül" },
  { quote: "Şahane mekan, burgerler çok lezzetli ve doyurucu. Ekmeklerini kendileri yapıyorlar, soğan halkası ev yapımı çıtır çıtır.", author: "Caner Özkan" },
  { quote: "Burgerler gerçekten lezzetliydi. Mag Berry ve Mag Classic tercih ettik. Çalışanlar da gayet ilgiliydi.", author: "Yerel Rehber" },
  { quote: "Ekmeklerin el yapımı olduğu belli ve tat olarak farklılığı anlayabiliyorsunuz. Tiftik eti gerçekten çok lezzetliydi.", author: "Yerel Rehber" },
];

/**
 * Makaradaki öne çıkan karolar. MÜŞTERİ PORTRESİ YOK — fotoğrafımız yok ve sahte portre
 * kullanmıyoruz; onun yerine kendi ürün kesimlerimiz dönüyor.
 */
export const REEL_IMAGES = ["smooky", "brisket", "berry", "jalapeno", "caesar"] as const;
