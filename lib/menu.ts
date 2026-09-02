/**
 * ÜRÜN VERİSİ — tek kaynak (spec §5, menüden birebir).
 * Fiyatlar ₺. Burgerlerin hepsi patates kızartması dahil.
 */

export type Category = "burger" | "taco" | "noodle" | "yan" | "sos" | "icecek";

export type HeroId = "smooky" | "brisket" | "berry" | "jalapeno" | "caesar";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  desc?: string;
  /** Ürün aksan rengi (yalnızca hero burgerler) */
  accent?: string;
  /** Ana sayfa sahnesinde cutout'u olan ürünler */
  hero?: boolean;
  /** Katman animasyonu için (sonraki faz) */
  layers?: string[];
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
      name: "Smooky",
      price: 620,
      accent: "#E2591F",
      hero: true,
      desc: "130 gr burger köftesi, füme kaburga, karamelize soğan, cheddar, iceberg marul, tütsü biberli aioli",
      layers: ["ust-ekmek", "aioli", "iceberg", "cheddar", "fume-kaburga", "karamelize-sogan", "kofte", "alt-ekmek"],
    },
    {
      id: "brisket",
      name: "Brisket",
      price: 600,
      accent: "#C89A63",
      hero: true,
      desc: "Ağır ateşte pişmiş tiftik et, karamelize soğan, cheddar, tütsü biberli aioli, soğan turşusu",
    },
    {
      id: "berry",
      name: "Mag Berry",
      price: 550,
      accent: "#8E3B52",
      hero: true,
      desc: "Karamelize vişne, gravyer peyniri, 130 gr burger köftesi",
    },
    {
      id: "jalapeno",
      name: "Jalapeno",
      price: 520,
      accent: "#7E9B57",
      hero: true,
      desc: "Jalapeno sos, cheddar, çıtır soğan, 130 gr burger köftesi, roka",
    },
    {
      id: "caesar",
      name: "Mag Caesar",
      price: 490,
      accent: "#D8B15E",
      hero: true,
      desc: "Mag sos, marul, gravyer, panelenmiş tavuk",
    },
    // foto yok
    { id: "orjinal", name: "Mag Orjinal", price: 520, desc: "Mag sos, kıtır soğan, cheddar, 130 gr burger köftesi" },
    {
      id: "truffle",
      name: "Truffle & Mush",
      price: 550,
      desc: "130 gr burger köftesi, mantar düxelles, trüflü mayonez, cheddar, soğan turşusu",
    },
    { id: "citir", name: "Mag Çıtır", price: 490, desc: "Panelenmiş tavuk parçaları, cips, sweet chili sos" },
  ],
  taco: [
    // 2 adet
    {
      id: "tavuk-taco",
      name: "Tavuk Taco",
      price: 450,
      desc: "Sotelenmiş baharatlı tavuk, iceberg marul, gravyer peyniri, avokado, chipotle mayo",
    },
    {
      id: "tiftik-taco",
      name: "Tiftik Taco",
      price: 530,
      desc: "Ağır ateşte pişmiş tiftik et, maydanoz & soğan, cheddar, tütsü biberli aioli",
    },
    {
      id: "karides-taco",
      name: "Karidesli Taco",
      price: 520,
      desc: "Tereyağında sotelenmiş karides, lahanaslaw, avokado, chipotle mayo, taze soğan",
    },
  ],
  noodle: [
    {
      id: "tavuklu-noodle",
      name: "Tavuklu",
      price: 450,
      desc: "Tavuk göğsü, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
    },
    {
      id: "karidesli-noodle",
      name: "Karidesli",
      price: 550,
      desc: "Karides, taze soğan, havuç, zencefil, kapya biber, soya sos, susam",
    },
  ],
  yan: [
    { id: "patates", name: "Patates kızartması (el yapımı)", price: 300 },
    { id: "patates-parmesan", name: "Patates kızartması (parmesanlı)", price: 350 },
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

/** Ana sayfa sahnesindeki 5 burger — menü sırasıyla, her biri bir kez. */
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
