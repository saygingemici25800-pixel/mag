/**
 * ÜRÜN VERİSİ — tek kaynak (spec §5, menüden birebir).
 * Fiyatlar ₺. Burgerlerin hepsi patates kızartması dahil.
 */

export type Category = "burger" | "taco" | "noodle" | "yan" | "sos" | "icecek";

/* 25 Eyl 2026: "citir" çıkarıldı — ürün menüden kaldırıldı, kesimi de
   kullanılmıyor. Karusel 7 burger. */
export type HeroId = "smooky" | "brisket" | "berry" | "jalapeno" | "caesar" | "orjinal" | "truffle";

export interface Ingredient {
  name: string;
  /** false: ana protein ya da ekmek — müşteri çıkaramaz */
  removable: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  desc?: string;
  /** Ana sayfa sahnesinde cutout'u olan ürünler */
  hero?: boolean;
  /** Katman animasyonu için (sonraki faz) */
  layers?: string[];
  /** Malzeme listesi — "malzeme çıkar" bunu kullanır (desc metninden türetildi, tek kaynak burası).
      removable:false → ana bileşen (protein) ve ekmek; listede görünür ama çıkarılamaz. */
  ingredients?: Ingredient[];
  /** "Şununla iyi gider" — ürün sheet'inde öneri çipleri (id) */
  pairs?: string[];
  /** Sepet/ödeme sayfasındaki "YANINDA İYİ GİDER" bölümünde öne çıkar */
  upsell?: boolean;
  /**
   * Hero olmayan ürünler için tabak/masa fotoğrafı (public altında yol).
   * Hero ürünleri saydam kesim kullanır (components/stage/cutouts.ts), bu alan onlar için değil.
   *
   * 12 Eyl 2026 — BİLİNÇLİ KARAR (kullanıcı onayı): taco ve noodle kalemlerinin
   * hepsi AYNI TEK görseli paylaşır. Dosya bir kez üretildi
   * (public/urun/ortak/noodle-taco-citir.webp = arşivdeki IMG_9115); beş kalem de
   * aynı yolu gösterir, KOPYALANMADI. Karede noodle, taco ve burger birlikte.
   */
  photo?: string;
}

export interface HeroItem extends MenuItem {
  id: HeroId;
  hero: true;
  desc: string;
}

/**
 * 20 Eyl 2026: noodle ve taco için AYRI kareler geldi; artık tek paylaşılan
 * görsel yok. Çeşitlerin kendi karesi YOK (işletme tek kare gönderdi), bu yüzden
 * tüm noodle çeşitleri NOODLE_PHOTO'yu, tüm taco çeşitleri TACO_PHOTO'yu
 * gösterir — dosya kopyalanmaz, sabit paylaşılır.
 */
export const NOODLE_PHOTO = "/urun/yan/noodle.webp";
export const TACO_PHOTO = "/urun/yan/taco.webp";

export const MENU: Record<Category, MenuItem[]> = {
  burger: [
    {
      id: "smooky",
      pairs: ["mag-sos", "truflu-mayonez", "ayran"],
      name: "Smooky",
      price: 620,
      hero: true,
      desc: "130 gr burger köftesi, füme kaburga, karamelize soğan, cheddar, iceberg marul, tütsü biberli aioli",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "130 gr burger köftesi", removable: false }, { name: "füme kaburga", removable: true }, { name: "karamelize soğan", removable: true }, { name: "cheddar", removable: true }, { name: "iceberg marul", removable: true }, { name: "tütsü biberli aioli", removable: true }],
      layers: ["ust-ekmek", "aioli", "iceberg", "cheddar", "fume-kaburga", "karamelize-sogan", "kofte", "alt-ekmek"],
    },
    {
      id: "truffle",
      pairs: ["jalapeno-sos", "mag-sos", "zencefilli-gazoz"],
      /* ID DÜZELTİLDİ (11 Eyl 2026): id ile görünen ad ters duruyordu — TRUFFLE'ın id'si
         "brisket"ti. orders tablosu (82 satır, hepsi e2e test kaydı) boşaltıldıktan sonra
         takas edildi; sipariş akmaya başlayınca bu düzeltme yapılamazdı.

         16 Eyl 2026: ad ve içerik İŞLETMEDEN ONAYLI. Fiyat değişmedi. */
      name: "TRUFFLE & MUSH",
      price: 600,
      hero: true,
      desc: "130 g dana köfte, mantar düxelles, trüf mayonez, cheddar, soğan turşusu",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "130 g dana köfte", removable: false }, { name: "mantar düxelles", removable: true }, { name: "trüf mayonez", removable: true }, { name: "cheddar", removable: true }, { name: "soğan turşusu", removable: true }],
    },
    {
      id: "berry",
      pairs: ["truflu-mayonez", "ayran"],
      name: "Mag Berry",
      price: 550,
      hero: true,
      desc: "Karamelize vişne, gravyer peyniri, 130 gr burger köftesi",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "Karamelize vişne", removable: true }, { name: "gravyer peyniri", removable: true }, { name: "130 gr burger köftesi", removable: false }],
    },
    {
      id: "jalapeno",
      pairs: ["mag-sos", "zencefilli-gazoz"],
      name: "Jalapeno",
      price: 520,
      hero: true,
      desc: "Jalapeno sos, cheddar, çıtır soğan, 130 gr burger köftesi, roka",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "Jalapeno sos", removable: true }, { name: "cheddar", removable: true }, { name: "çıtır soğan", removable: true }, { name: "130 gr burger köftesi", removable: false }, { name: "roka", removable: true }],
    },
    {
      id: "caesar",
      pairs: ["truflu-mayonez", "ayran"],
      name: "Mag Caesar",
      price: 490,
      hero: true,
      desc: "Mag sos, marul, gravyer, panelenmiş tavuk",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "Mag sos", removable: true }, { name: "marul", removable: true }, { name: "gravyer", removable: true }, { name: "panelenmiş tavuk", removable: false }],
    },
    // foto yok → hero'da tipografik kutu; public/urun/<id>.webp gelince otomatik cutout (lib/cutouts-available.ts)
    {
      id: "orjinal",
      pairs: ["jalapeno-sos", "mag-sos", "ayran"],
      name: "Mag Orjinal",
      price: 520,
      hero: true,
      desc: "Mag sos, kıtır soğan, cheddar, 130 gr burger köftesi",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "Mag sos", removable: true }, { name: "kıtır soğan", removable: true }, { name: "cheddar", removable: true }, { name: "130 gr burger köftesi", removable: false }],
    },
    {
      id: "brisket",
      pairs: ["truflu-mayonez", "zencefilli-gazoz"],
      /* ID DÜZELTİLDİ (11 Eyl 2026): id ile görünen ad ters duruyordu.
         16 Eyl 2026: içerik İŞLETMEDEN ONAYLI — artık gerçekten BRISKET'e ait
         (önce TRUFFLE'ın trüflü/mantarlı listesi duruyordu). Fiyat değişmedi.
         Ana protein "yavaş pişmiş lifli dana eti": ekmekle birlikte kaldırılamaz. */
      name: "Brisket",
      price: 550,
      hero: true,
      desc: "yavaş pişmiş lifli dana eti, karamelize soğan, cheddar, füme biber aiolisi, soğan turşusu",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "yavaş pişmiş lifli dana eti", removable: false }, { name: "karamelize soğan", removable: true }, { name: "cheddar", removable: true }, { name: "füme biber aiolisi", removable: true }, { name: "soğan turşusu", removable: true }],
    },
    
  ],
  taco: [
    // 2 adet
    {
      id: "tavuk-taco",
      photo: TACO_PHOTO,
      pairs: ["ayran", "zencefilli-gazoz"],
      name: "Tavuk Taco",
      price: 450,
      desc: "Sotelenmiş baharatlı tavuk, iceberg marul, gravyer peyniri, avokado, chipotle mayo",
      ingredients: [{ name: "Sotelenmiş baharatlı tavuk", removable: false }, { name: "iceberg marul", removable: true }, { name: "gravyer peyniri", removable: true }, { name: "avokado", removable: true }, { name: "chipotle mayo", removable: true }],
    },
    {
      id: "tiftik-taco",
      photo: TACO_PHOTO,
      pairs: ["ayran", "alkolsuz-bira"],
      name: "Tiftik Taco",
      price: 530,
      desc: "Ağır ateşte pişmiş tiftik et, maydanoz & soğan, cheddar, tütsü biberli aioli",
      ingredients: [{ name: "Ağır ateşte pişmiş tiftik et", removable: false }, { name: "maydanoz & soğan", removable: true }, { name: "cheddar", removable: true }, { name: "tütsü biberli aioli", removable: true }],
    },
    {
      id: "karides-taco",
      photo: TACO_PHOTO,
      pairs: ["zencefilli-gazoz", "soda"],
      name: "Karidesli Taco",
      price: 520,
      desc: "Tereyağında sotelenmiş karides, lahanaslaw, avokado, chipotle mayo, taze soğan",
      ingredients: [{ name: "Tereyağında sotelenmiş karides", removable: false }, { name: "lahanaslaw", removable: true }, { name: "avokado", removable: true }, { name: "chipotle mayo", removable: true }, { name: "taze soğan", removable: true }],
    },
  ],
  noodle: [
    {
      id: "tavuklu-noodle",
      photo: NOODLE_PHOTO,
      pairs: ["zencefilli-gazoz", "ayran"],
      name: "Tavuklu Noodle",
      price: 450,
      desc: "Tavuk göğsü, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
      ingredients: [{ name: "Tavuk göğsü", removable: false }, { name: "taze soğan", removable: true }, { name: "havuç", removable: true }, { name: "zencefil", removable: true }, { name: "kapya biber", removable: true }, { name: "soya sos", removable: true }, { name: "susam", removable: true }],
    },
    {
      id: "karidesli-noodle",
      photo: NOODLE_PHOTO,
      pairs: ["soda", "alkolsuz-bira"],
      name: "Karidesli Noodle",
      price: 550,
      desc: "Karides, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
      ingredients: [{ name: "Karides", removable: false }, { name: "taze soğan", removable: true }, { name: "havuç", removable: true }, { name: "zencefil", removable: true }, { name: "kapya biber", removable: true }, { name: "soya sos", removable: true }, { name: "susam", removable: true }],
    },
  ],
  yan: [
    { id: "patates", photo: "/urun/yan/patates.webp", pairs: ["truflu-mayonez", "sweet-chili"], name: "Patates kızartması (el yapımı)", price: 300 },
    /* 20 Eyl 2026: görseli gelen yeni yan ürün. FİYAT HENÜZ VERİLMEDİ —
       işletme bildirince güncellenecek. MAG ÇITIR burgeriyle KARIŞTIRMA:
       o ayrı bir ürün (burger kategorisi, kendi kesimi var). */
    /* 21 Eyl 2026: ad ve açıklama MAG ÇITIR'dan ayrıştırıldı — ikisi de yan
       ürünlerde ve ikisi de "çıtır" içeriyordu, karışıyordu. Bu TABAK/porsiyon,
       MAG ÇITIR ise EKMEK ARASI. İçerik listesi değişmedi. */
    {
      id: "citir-tavuk",
      photo: "/urun/yan/citir-tavuk.webp",
      /* 25 Eyl 2026: ad "MAG ÇITIR" oldu (kullanıcı kararı). Marka adı, üç dilde
         de ÇEVRİLMEZ. id DEĞİŞMEDİ — geçmiş siparişler bozulmasın. Açıklama,
         içerik, fiyat ve görsel aynen kaldı.
         Eski ₺490'lık "MAG ÇITIR" (id: citir, ekmek arası burger) aynı gün
         menüden tamamen KALDIRILDI; ad çakışması böylece bitti. */
      name: "MAG ÇITIR",
      price: 0,
      desc: "Tabakta servis: çıtır tavuk parçaları, yanında patates kızartması ve sos",
    },
    { id: "patates-parmesan", photo: "/urun/yan/patates-peynirli.webp", pairs: ["mag-sos", "jalapeno-sos"], name: "Patates kızartması (parmesanlı)", price: 350 },
  ],
  sos: [
    /* 22 Eyl 2026: sos görselleri geldi (public/urun/sos/). Dosya adları ürün
       id'siyle birebir; tek istisna truf-mayo.webp → truflu-mayonez.
       Kesimler YATAY (~660×480); --ic mutlak sınır sistemi kutuya sığdırır. */
    // 50 ₺
    { id: "truflu-mayonez", photo: "/urun/sos/truf-mayo.webp", name: "Trüflü mayonez", price: 50 },
    { id: "jalapeno-sos", photo: "/urun/sos/jalapeno-sos.webp", name: "Jalapeno", price: 50 },
    { id: "sweet-chili", photo: "/urun/sos/sweet-chili.webp", name: "Sweet & chili", price: 50 },
    { id: "mag-sos", photo: "/urun/sos/mag-sos.webp", name: "Mag sos", price: 50 },
    { id: "tutsu-biberli-aioli", photo: "/urun/sos/tutsu-biberli-aioli.webp", name: "Tütsü biberli aioli", price: 50, upsell: true }, // AÇIK: fiyat işletmeden teyit edilecek
  ],
  icecek: [
    { id: "ayran", photo: "/urun/icecek/ayran.webp", name: "Arslan ayran", price: 90 },
    /* 20 Eyl 2026: genel "İçecekler" kalemi KALDIRILDI; yerine görselleri gelen
       altı içecek ayrı kalem oldu (kullanıcı kararı, hepsi ₺110). Eski kalem
       hiçbir siparişte kullanılmamıştı (canlıda 0 kayıt), pairs'te geçmiyordu. */
    { id: "kola-zero", photo: "/urun/icecek/kola-zero.webp", name: "Kola Zero", price: 110 },
    { id: "kola-light", photo: "/urun/icecek/kola-light.webp", name: "Kola Light", price: 110 },
    { id: "sprite", photo: "/urun/icecek/sprite.webp", name: "Sprite", price: 110 },
    { id: "fanta", photo: "/urun/icecek/fanta-sari-kola.webp", name: "Fanta", price: 110 },
    { id: "uludag-portakalli", photo: "/urun/icecek/uludag-portakalli.webp", name: "Uludağ portakallı", price: 110 },
    { id: "uludag-gazoz", photo: "/urun/icecek/uludag-gazoz.webp", name: "Uludağ gazoz", price: 110 },
    { id: "su", photo: "/urun/icecek/su.webp", name: "Uludağ Premium Su", price: 50 },
    { id: "soda", photo: "/urun/icecek/maden-suyu.webp", name: "Uludağ Maden Suyu", price: 70 },
    { id: "zencefilli-gazoz", photo: "/urun/icecek/ginger.webp", name: "Zencefilli gazoz", price: 190 },
    { id: "alkolsuz-bira", photo: "/urun/icecek/bitburger-00.webp", name: "Alkolsüz bira", price: 190 },
    { id: "kola", photo: "/urun/icecek/kola.webp", name: "Kola", price: 110, upsell: true }, // AÇIK: fiyat ve marka işletmeden teyit edilecek
    { id: "limonata", photo: "/urun/icecek/limonata.webp", name: "Limonata", price: 130, upsell: true }, // AÇIK: fiyat ve ev yapımı olup olmadığı işletmeden teyit edilecek
  ],
};

/** "YANINDA İYİ GİDER" — sepette önerilen içecek / sos / yan ürünler (sıra: içecek → yan → sos).
    Fiyat ve içerik AÇIK: işletmeden teyit edilecek (lib/menu.ts içindeki satır yorumları). */
export const UPSELL_IDS = ["ayran", "kola", "limonata", "patates", "tutsu-biberli-aioli"] as const;

/** Öneri listesi — menü sırasına değil UPSELL_IDS sırasına uyar */
export function upsellItems(): MenuItem[] {
  const all = [...MENU.icecek, ...MENU.yan, ...MENU.sos];
  return UPSELL_IDS.map((id) => all.find((m) => m.id === id)).filter((m): m is MenuItem => Boolean(m));
}

export const CATEGORY_LABELS: Record<Category, string> = {
  burger: "Burger",
  taco: "Taco",
  noodle: "Noodle",
  yan: "Yan",
  sos: "Sos",
  icecek: "İçecek",
};

/** Ana sayfa sahnesindeki 8 burger — menü sırasıyla, her biri bir kez. */
export const HERO_ITEMS: HeroItem[] = MENU.burger.filter(
  (m): m is HeroItem => m.hero === true && typeof m.desc === "string",
);

/** "Mag Berry" → ["MAG", "BERRY"], "Smooky" → ["SMOOKY", ""] */
export function splitTitle(name: string): [string, string] {
  // Ürün adları marka/İngilizce (Brisket → BRISKET); Türkçe locale "İ" üretmesin diye düz toUpperCase.
  const parts = name.toUpperCase().split(" ");
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

export function formatPrice(price: number): string {
  return `₺${price}`;
}

/**
 * Ürünün GEÇERLİ fiyatı — TEK KAYNAK.
 *
 * Sıra: panelden gelen harita (settings.prices) → koddaki m.price.
 * Panel fiyatı yoksa kodunki geçerli, yani veritabanı boşken site çalışır.
 * Fiyat gösteren/hesaplayan her yer bu fonksiyondan geçmeli; doğrudan `m.price`
 * okuyan kod panel değişikliğini GÖRMEZ.
 */
export function priceOf(m: Pick<MenuItem, "id" | "price">, prices?: Record<string, number> | null): number {
  const over = prices?.[m.id];
  return typeof over === "number" && Number.isInteger(over) && over > 0 ? over : m.price;
}

/** id'den fiyat (ürün bulunamazsa 0 — çağıran zaten ürünü doğruluyor). */
export function priceById(id: string, prices?: Record<string, number> | null): number {
  const m = Object.values(MENU).flat().find((x) => x.id === id);
  return m ? priceOf(m, prices) : 0;
}
