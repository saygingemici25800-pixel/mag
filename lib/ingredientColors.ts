/**
 * İçindekiler satırında malzeme sözcükleri vurgulanır: tek palet (mor/limon) — her tür ana yazı renginde (--cream), gövde ikincil (--dim) kalır.
 * Hem ana sayfa (dive kopyası) hem sipariş sayfası (kart açıklaması, sheet) aynı fonksiyondan geçer. TR + EN anahtar kelimeler.
 */
export type IngredientKind = "meat" | "cheese" | "green" | "sauce" | "pickle" | "plain";

export const INGREDIENT_COLORS: Record<Exclude<IngredientKind, "plain">, string> = {
  meat: "var(--cream)",
  cheese: "var(--cream)",
  green: "var(--cream)",
  sauce: "var(--cream)",
  pickle: "var(--cream)",
};

const WORDS: Record<Exclude<IngredientKind, "plain">, string[]> = {
  // öncelik sırası: turşu/vişne > et > peynir > yeşil > sos ("jalapeno sos" sos, "soğan turşusu" turşu)
  pickle: ["turşu", "turşusu", "vişne", "pickled", "cherry"],
  meat: ["köfte", "köftesi", "kaburga", "brisket", "tiftik", "tavuk", "karides", "et", "patty", "beef", "rib", "chicken", "shrimp", "pulled"],
  cheese: ["cheddar", "gravyer", "gruyère", "gruyere", "peynir", "peyniri", "parmesan", "parmesanlı"],
  green: ["marul", "roka", "iceberg", "lettuce", "rocket", "avokado", "avocado"],
  sauce: ["aioli", "mayonez", "mayo", "sos", "sauce", "chili", "chipotle", "jalapeno", "jalapeño", "glaze"],
};
const ORDER: Exclude<IngredientKind, "plain">[] = ["pickle", "meat", "cheese", "green", "sauce"];

function kindOf(phrase: string): IngredientKind {
  const words = phrase.toLocaleLowerCase("tr-TR").split(/[^a-zçğıöşüâîû&]+/i).filter(Boolean);
  for (const k of ORDER) if (words.some((w) => WORDS[k].includes(w))) return k;
  return "plain";
}

export interface IngredientPart {
  text: string;
  kind: IngredientKind;
  color?: string;
}

/** "130 gr burger köftesi, füme kaburga, cheddar" → virgülle ayrılmış parçalar, her biri türüyle */
export function colorizeIngredients(text: string): IngredientPart[] {
  return text.split(/(,\s*)/).map((seg) => {
    if (/^,\s*$/.test(seg)) return { text: seg, kind: "plain" as const };
    const kind = kindOf(seg);
    return { text: seg, kind, color: kind === "plain" ? undefined : INGREDIENT_COLORS[kind] };
  });
}
