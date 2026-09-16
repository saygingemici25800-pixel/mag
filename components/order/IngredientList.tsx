"use client";

import { useT } from "@/components/LocaleProvider";
import { ingName } from "@/lib/i18n";
import type { Ingredient, MenuItem } from "@/lib/menu";

interface Props {
  item: MenuItem;
  /** Şu an çıkarılmış malzeme adları (TÜRKÇE — satır kimliği buna dayanır) */
  removed: string[];
  onChange: (removed: string[]) => void;
}

/**
 * Malzeme çıkarma listesi — HER ZAMAN AÇIK, sepet satırının altında.
 *
 * 16 Eyl 2026: eski açılır kart (IngredientPicker) KALDIRILDI. Tıklayıp kutu
 * açmak gerekiyordu, kutu da büyük ve dağınıktı. Artık Burger King'deki
 * "Çıkarılabilir Malzeme" listesi gibi: satır satır, sağda onay kutusu.
 *
 * Kurallar:
 * - Kutu İŞARETLİ = o malzeme ÇIKARILDI (adı üstü çizili, rengi söner).
 * - removable:false (ekmek + ana protein) çıkarılamaz: kutusu yok, "çıkarılamaz"
 *   etiketi var, satır sönük ve tıklanamaz. Bunlar listenin EN ÜSTÜNDE durur.
 * - Fiyat DEĞİŞMEZ; burada fiyata dair hiçbir şey gösterilmez.
 * - Malzeme ADI çeviriden gelir (ingName); data-ing ve sepet anahtarı TÜRKÇE
 *   kalır — satır kimliği ve sunucudaki beyaz liste Türkçe ada dayanıyor.
 * - Erişilebilirlik: her satır bir <button role="checkbox"> değil, gerçek
 *   <input type="checkbox"> + <label>; Tab ile gezilir, Space ile işaretlenir.
 *   Tüm satır etiket olduğu için dokunma hedefi 40 px yüksekliğinde.
 */
export default function IngredientList({ item, removed, onChange }: Props) {
  const t = useT();
  const o = t.order;
  const list: Ingredient[] = item.ingredients ?? [];
  if (list.length === 0) return null;

  /* Çıkarılamazlar önce, çıkarılabilirler sonra — menüdeki sıra korunur. */
  const fixed = list.filter((i) => !i.removable);
  const free = list.filter((i) => i.removable);
  const ordered = [...fixed, ...free];

  const toggle = (name: string) => {
    onChange(removed.includes(name) ? removed.filter((r) => r !== name) : [...removed, name]);
  };

  const count = removed.length;
  /* Başlık sayacı YALNIZCA 1+ seçiliyken: "Malzeme çıkar (2)" */
  const title = count > 0 ? o.removeIngredientsCount.replace("{n}", String(count)) : o.removeIngredients;

  return (
    <div className="inglist-wrap" data-ing-list>
      <div className="inglist-title">{title}</div>
      {/* 6'dan uzun listede kendi içinde kayar; alt kenarda fade göstergesi */}
      <ul className={"inglist" + (ordered.length > 6 ? " scroll" : "")}>
        {ordered.map((ing) => {
          const shown = ingName(t, ing.name);
          if (!ing.removable) {
            return (
              <li key={ing.name} className="ingrow ingfix" data-ing={ing.name} data-removable="false">
                <span className="ingrow-name">{shown}</span>
                <span className="ingrow-fixed">{o.notRemovable}</span>
              </li>
            );
          }
          const isOut = removed.includes(ing.name);
          return (
            <li key={ing.name} className={"ingrow" + (isOut ? " out" : "")} data-ing={ing.name} data-removable="true">
              <label className="ingrow-label">
                <span className="ingrow-name">{shown}</span>
                <input
                  type="checkbox"
                  className="ingbox"
                  checked={isOut}
                  onChange={() => toggle(ing.name)}
                  aria-label={`${shown}, ${isOut ? o.removedState : o.includedState}`}
                  data-ing-box={ing.name}
                />
                <span className="ingbox-fake" aria-hidden="true" />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
