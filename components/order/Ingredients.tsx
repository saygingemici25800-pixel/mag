import { colorizeIngredients } from "@/lib/ingredientColors";

/** İçindekiler metni — malzemeler renkli span'ler halinde. */
export default function Ingredients({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {colorizeIngredients(text).map((p, i) =>
        p.color ? (
          <span key={i} style={{ color: p.color }} data-kind={p.kind}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
