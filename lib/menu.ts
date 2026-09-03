/**
 * ÜRÜN VERİSİ — tek kaynak (spec §5, menüden birebir).
 * Fiyatlar ₺. Burgerlerin hepsi patates kızartması dahil.
 */

export type Category = "burger" | "taco" | "noodle" | "yan" | "sos" | "icecek";

export type HeroId = "smooky" | "brisket" | "berry" | "jalapeno" | "caesar" | "orjinal" | "truffle" | "citir";

/** Katman aşamaları — ana sayfadaki 4 iddiayla aynı sıra: et → ekmek → peynir → sos */
export type StageKey = "et" | "ekmek" | "peynir" | "sos";
export const STAGE_KEYS: StageKey[] = ["et", "ekmek", "peynir", "sos"];
export interface StageImage {
  key: StageKey;
  /** public altındaki yol; dosya varsa build'de tespit edilir (lib/katman.ts) */
  image: string;
}
/** /assets/katman/<id>-1-et.webp … <id>-4-sos.webp — görseller gelince klasöre atılır, kod değişmez */
export function stagesFor(id: string): StageImage[] {
  return STAGE_KEYS.map((key, i) => ({ key, image: `/assets/katman/${id}-${i + 1}-${key}.webp` }));
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  desc?: string;
  /** Ürün aksan rengi (yalnızca hero burgerler) */
  accent?: string;
  /** Arka plan gradyanı [c1, c2] — hero'da linear-gradient(135deg, c1, c2); renkler ayrıca gelecek */
  bg?: [string, string];
  /** Ana sayfa sahnesinde cutout'u olan ürünler */
  hero?: boolean;
  /** Katman animasyonu için (sonraki faz) */
  layers?: string[];
  /** Katman aşaması görselleri (iddia bölümündeki slot) */
  stages?: StageImage[];
  /** "Şununla iyi gider" — ürün sheet'inde öneri çipleri (id) */
  pairs?: string[];
}

export interface HeroItem extends MenuItem {
  id: HeroId;
  accent: string;
  hero: true;
  desc: string;
}

export const MENU: Record<Category, MenuItem[]> = {
  burger: [
    {
      id: "smooky",
      pairs: ["mag-sos", "truflu-mayonez", "ayran"],
      stages: stagesFor("smooky"),
      name: "Smooky",
      price: 620,
      accent: "#E2591F",
      bg: ["#E2591F", "#14100F"],
      hero: true,
      desc: "130 gr burger köftesi, füme kaburga, karamelize soğan, cheddar, iceberg marul, tütsü biberli aioli",
      layers: ["ust-ekmek", "aioli", "iceberg", "cheddar", "fume-kaburga", "karamelize-sogan", "kofte", "alt-ekmek"],
    },
    {
      id: "brisket",
      pairs: ["jalapeno-sos", "mag-sos", "zencefilli-gazoz"],
      stages: stagesFor("brisket"),
      name: "Brisket",
      price: 600,
      accent: "#C89A63",
      bg: ["#C89A63", "#14100F"],
      hero: true,
      desc: "Ağır ateşte pişmiş tiftik et, karamelize soğan, cheddar, tütsü biberli aioli, soğan turşusu",
    },
    {
      id: "berry",
      pairs: ["truflu-mayonez", "ayran"],
      stages: stagesFor("berry"),
      name: "Mag Berry",
      price: 550,
      accent: "#8E3B52",
      bg: ["#8E3B52", "#14100F"],
      hero: true,
      desc: "Karamelize vişne, gravyer peyniri, 130 gr burger köftesi",
    },
    {
      id: "jalapeno",
      pairs: ["mag-sos", "zencefilli-gazoz"],
      stages: stagesFor("jalapeno"),
      name: "Jalapeno",
      price: 520,
      accent: "#7E9B57",
      bg: ["#7E9B57", "#14100F"],
      hero: true,
      desc: "Jalapeno sos, cheddar, çıtır soğan, 130 gr burger köftesi, roka",
    },
    {
      id: "caesar",
      pairs: ["truflu-mayonez", "ayran"],
      stages: stagesFor("caesar"),
      name: "Mag Caesar",
      price: 490,
      accent: "#D8B15E",
      bg: ["#D8B15E", "#14100F"],
      hero: true,
      desc: "Mag sos, marul, gravyer, panelenmiş tavuk",
    },
    // foto yok → hero'da tipografik kutu; assets/cut/<id>.webp gelince otomatik cutout (lib/cutouts-available.ts)
    {
      id: "orjinal",
      pairs: ["jalapeno-sos", "mag-sos", "ayran"],
      stages: stagesFor("orjinal"),
      name: "Mag Orjinal",
      price: 520,
      accent: "#B8672E",
      bg: ["#B8672E", "#14100F"],
      hero: true,
      desc: "Mag sos, kıtır soğan, cheddar, 130 gr burger köftesi",
    },
    {
      id: "truffle",
      pairs: ["truflu-mayonez", "zencefilli-gazoz"],
      stages: stagesFor("truffle"),
      name: "Truffle & Mush",
      price: 550,
      accent: "#7C6A9E",
      bg: ["#7C6A9E", "#14100F"],
      hero: true,
      desc: "130 gr burger köftesi, mantar düxelles, trüflü mayonez, cheddar, soğan turşusu",
    },
    {
      id: "citir",
      pairs: ["sweet-chili", "ayran"],
      stages: stagesFor("citir"),
      name: "Mag Çıtır",
      price: 490,
      accent: "#D9A441",
      bg: ["#D9A441", "#14100F"],
      hero: true,
      desc: "Panelenmiş tavuk parçaları, cips, sweet chili sos",
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
    },
    {
      id: "tiftik-taco",
      pairs: ["ayran", "alkolsuz-bira"],
      name: "Tiftik Taco",
      price: 530,
      desc: "Ağır ateşte pişmiş tiftik et, maydanoz & soğan, cheddar, tütsü biberli aioli",
    },
    {
      id: "karides-taco",
      pairs: ["zencefilli-gazoz", "soda"],
      name: "Karidesli Taco",
      price: 520,
      desc: "Tereyağında sotelenmiş karides, lahanaslaw, avokado, chipotle mayo, taze soğan",
    },
  ],
  noodle: [
    {
      id: "tavuklu-noodle",
      pairs: ["zencefilli-gazoz", "ayran"],
      name: "Tavuklu",
      price: 450,
      desc: "Tavuk göğsü, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
    },
    {
      id: "karidesli-noodle",
      pairs: ["soda", "alkolsuz-bira"],
      name: "Karidesli",
      price: 550,
      desc: "Karides, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
    },
  ],
  yan: [
    { id: "patates", pairs: ["truflu-mayonez", "sweet-chili"], name: "Patates kızartması (el yapımı)", price: 300 },
    { id: "patates-parmesan", pairs: ["mag-sos", "jalapeno-sos"], name: "Patates kızartması (parmesanlı)", price: 350 },
  ],
  sos: [
    // 50 ₺
    { id: "truflu-mayonez", name: "Trüflü mayonez", price: 50 },
    { id: "jalapeno-sos", name: "Jalapeno", price: 50 },
    { id: "sweet-chili", name: "Sweet & chili", price: 50 },
    { id: "mag-sos", name: "Mag sos", price: 50 },
  ],
  icecek: [
    { id: "ayran", name: "Arslan ayran", price: 90 },
    { id: "icecekler", name: "İçecekler", price: 110 }, // AÇIK: içerik (kola/fanta vb.)
    { id: "su", name: "Su", price: 50 },
    { id: "soda", name: "Soda", price: 70 },
    { id: "zencefilli-gazoz", name: "Zencefilli gazoz", price: 190 },
    { id: "alkolsuz-bira", name: "Alkolsüz bira", price: 190 },
  ],
};

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
  (m): m is HeroItem => m.hero === true && typeof m.accent === "string" && typeof m.desc === "string",
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
