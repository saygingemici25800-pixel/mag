/**
 * ÜRÜN VERİSİ — tek kaynak (spec §5, menüden birebir).
 * Fiyatlar ₺. Burgerlerin hepsi patates kızartması dahil.
 */

export type Category = "burger" | "taco" | "noodle" | "yan" | "sos" | "icecek";

export type HeroId = "smooky" | "brisket" | "berry" | "jalapeno" | "caesar" | "orjinal" | "truffle" | "citir";

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
}

export interface HeroItem extends MenuItem {
  id: HeroId;
  hero: true;
  desc: string;
}

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
      id: "brisket",
      pairs: ["jalapeno-sos", "mag-sos", "zencefilli-gazoz"],
      /* AD DEĞİŞTİ (10 Eyl 2026): bu kayıt artık TRUFFLE. id KORUNDU — sepet anahtarları,
         dilim dosyaları ve mevcut siparişler id'ye bağlı.
         Fotoğrafı değişmedi (public/urun/brisket.webp).
         İçerik 11 Eyl 2026'da işletmeden onaylı listeyle güncellendi.
         Fiyat DEĞİŞMEDİ: işletmeden gelmedi. */
      name: "Truffle",
      price: 600,
      hero: true,
      desc: "130 gr burger köftesi, trüf mayonez, gravyer peyniri, karamelize mantar, roka",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "130 gr burger köftesi", removable: false }, { name: "trüf mayonez", removable: true }, { name: "gravyer peyniri", removable: true }, { name: "karamelize mantar", removable: true }, { name: "roka", removable: true }],
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
      id: "truffle",
      pairs: ["truflu-mayonez", "zencefilli-gazoz"],
      /* AD DEĞİŞTİ (10 Eyl 2026): bu kayıt artık BRISKET, yeni fotoğrafıyla
         (public/urun/brisket.webp). id KORUNDU.
         AÇIK: desc ve ingredients hâlâ eski (trüflü/mantarlı) — brisket'e ait değil,
         işletmeden gelecek. */
      name: "Brisket",
      price: 550,
      hero: true,
      desc: "130 gr burger köftesi, mantar düxelles, trüflü mayonez, cheddar, soğan turşusu",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "130 gr burger köftesi", removable: false }, { name: "mantar düxelles", removable: true }, { name: "trüflü mayonez", removable: true }, { name: "cheddar", removable: true }, { name: "soğan turşusu", removable: true }],
    },
    {
      id: "citir",
      pairs: ["sweet-chili", "ayran"],
      name: "Mag Çıtır",
      price: 490,
      hero: true,
      desc: "Panelenmiş tavuk parçaları, cips, sweet chili sos",
      ingredients: [{ name: "brioche ekmek", removable: false }, { name: "Panelenmiş tavuk parçaları", removable: false }, { name: "cips", removable: true }, { name: "sweet chili sos", removable: true }],
    },
  ],
  taco: [
    // 2 adet
    {
      id: "tavuk-taco",
      pairs: ["ayran", "zencefilli-gazoz"],
      name: "Tavuk Taco",
      price: 450,
      desc: "Sotelenmiş baharatlı tavuk, iceberg marul, gravyer peyniri, avokado, chipotle mayo",
      ingredients: [{ name: "Sotelenmiş baharatlı tavuk", removable: false }, { name: "iceberg marul", removable: true }, { name: "gravyer peyniri", removable: true }, { name: "avokado", removable: true }, { name: "chipotle mayo", removable: true }],
    },
    {
      id: "tiftik-taco",
      pairs: ["ayran", "alkolsuz-bira"],
      name: "Tiftik Taco",
      price: 530,
      desc: "Ağır ateşte pişmiş tiftik et, maydanoz & soğan, cheddar, tütsü biberli aioli",
      ingredients: [{ name: "Ağır ateşte pişmiş tiftik et", removable: false }, { name: "maydanoz & soğan", removable: true }, { name: "cheddar", removable: true }, { name: "tütsü biberli aioli", removable: true }],
    },
    {
      id: "karides-taco",
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
      pairs: ["zencefilli-gazoz", "ayran"],
      name: "Tavuklu",
      price: 450,
      desc: "Tavuk göğsü, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
      ingredients: [{ name: "Tavuk göğsü", removable: false }, { name: "taze soğan", removable: true }, { name: "havuç", removable: true }, { name: "zencefil", removable: true }, { name: "kapya biber", removable: true }, { name: "soya sos", removable: true }, { name: "susam", removable: true }],
    },
    {
      id: "karidesli-noodle",
      pairs: ["soda", "alkolsuz-bira"],
      name: "Karidesli",
      price: 550,
      desc: "Karides, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
      ingredients: [{ name: "Karides", removable: false }, { name: "taze soğan", removable: true }, { name: "havuç", removable: true }, { name: "zencefil", removable: true }, { name: "kapya biber", removable: true }, { name: "soya sos", removable: true }, { name: "susam", removable: true }],
    },
  ],
  yan: [
    { id: "patates", pairs: ["truflu-mayonez", "sweet-chili"], name: "Patates kızartması (el yapımı)", price: 300 },
    { id: "patates-parmesan", pairs: ["mag-sos", "jalapeno-sos"], name: "Patates kızartması (parmesanlı)", price: 350 },
    { id: "sogan-halkasi", name: "Soğan halkası", price: 220, upsell: true }, // AÇIK: fiyat ve porsiyon işletmeden teyit edilecek
  ],
  sos: [
    // 50 ₺
    { id: "truflu-mayonez", name: "Trüflü mayonez", price: 50 },
    { id: "jalapeno-sos", name: "Jalapeno", price: 50 },
    { id: "sweet-chili", name: "Sweet & chili", price: 50 },
    { id: "mag-sos", name: "Mag sos", price: 50 },
    { id: "ekstra-cheddar-sos", name: "Ekstra cheddar sos", price: 50, upsell: true }, // AÇIK: fiyat işletmeden teyit edilecek
    { id: "tutsu-biberli-aioli", name: "Tütsü biberli aioli", price: 50, upsell: true }, // AÇIK: fiyat işletmeden teyit edilecek
  ],
  icecek: [
    { id: "ayran", name: "Arslan ayran", price: 90 },
    { id: "icecekler", name: "İçecekler", price: 110 }, // AÇIK: içerik (kola/fanta vb.)
    { id: "su", name: "Su", price: 50 },
    { id: "soda", name: "Soda", price: 70 },
    { id: "zencefilli-gazoz", name: "Zencefilli gazoz", price: 190 },
    { id: "alkolsuz-bira", name: "Alkolsüz bira", price: 190 },
    { id: "salgam", name: "Şalgam", price: 90, upsell: true }, // AÇIK: fiyat ve acılı/acısız seçeneği işletmeden teyit edilecek
    { id: "kola", name: "Kola", price: 110, upsell: true }, // AÇIK: fiyat ve marka işletmeden teyit edilecek
    { id: "limonata", name: "Limonata", price: 130, upsell: true }, // AÇIK: fiyat ve ev yapımı olup olmadığı işletmeden teyit edilecek
  ],
};

/** "YANINDA İYİ GİDER" — sepette önerilen içecek / sos / yan ürünler (sıra: içecek → yan → sos).
    Fiyat ve içerik AÇIK: işletmeden teyit edilecek (lib/menu.ts içindeki satır yorumları). */
export const UPSELL_IDS = ["ayran", "salgam", "kola", "limonata", "patates", "sogan-halkasi", "ekstra-cheddar-sos", "tutsu-biberli-aioli"] as const;

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
