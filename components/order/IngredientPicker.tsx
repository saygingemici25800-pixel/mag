"use client";

import { useT } from "@/components/LocaleProvider";
import type { Ingredient, MenuItem } from "@/lib/menu";

interface Props {
  item: MenuItem;
  /** Şu an çıkarılmış malzeme adları */
  removed: string[];
  onChange: (removed: string[]) => void;
  /** Mobilde alttan sheet, masaüstünde satır altı panel — kapatma düğmesi için */
  onClose?: () => void;
}

/**
 * Malzeme çıkarma listesi. Malzemeler lib/menu.ts'teki `ingredients` alanından gelir (tek kaynak).
 *
 * - Her malzeme bir <button> (aria-pressed): tıklayınca üstü çizilir ve "çıkarıldı" olur.
 * - removable:false olanlar (ana protein + ekmek) pasif; yanında "çıkarılamaz" notu.
 * - Fiyat DEĞİŞMEZ; burada fiyata dair hiçbir şey yazılmaz.
 * - Ekran okuyucu: "karamelize soğan, çıkarıldı" (aria-label durum içerir).
 */
export default function IngredientPicker({ item, removed, onChange, onClose }: Props) {
  const t = useT();
  const o = t.order;
  const list: Ingredient[] = item.ingredients ?? [];
  if (list.length === 0) return null;

  const toggle = (name: string) => {
    onChange(removed.includes(name) ? removed.filter((r) => r !== name) : [...removed, name]);
  };

  return (
    <div className="ingpick" data-ing-picker>
      <div className="ingpick-head">
        <span className="ingpick-title">{o.removeIngredients}</span>
        {onClose ? (
          <button type="button" className="ingpick-close" onClick={onClose} aria-label={o.close}>
            ×
          </button>
        ) : null}
      </div>
      <ul className="inglist">
        {list.map((ing) => {
          const isOut = removed.includes(ing.name);
          const label = ing.removable ? `${ing.name}, ${isOut ? o.removedState : o.includedState}` : `${ing.name}, ${o.notRemovable}`;
          return (
            <li key={ing.name}>
              <button
                type="button"
                className={"ingchip" + (isOut ? " out" : "") + (ing.removable ? "" : " ingfix")}
                onClick={() => ing.removable && toggle(ing.name)}
                disabled={!ing.removable}
                aria-pressed={ing.removable ? isOut : undefined}
                aria-label={label}
                data-ing={ing.name}
                data-removable={ing.removable}
              >
                <span className="ingname">{ing.name}</span>
                {ing.removable ? null : <small className="ingfixed">{o.notRemovable}</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
