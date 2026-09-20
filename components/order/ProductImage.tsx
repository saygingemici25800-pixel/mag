"use client";

import Image from "next/image";
import { CUTOUTS_M } from "@/components/stage/cutouts";
import type { HeroId, MenuItem } from "@/lib/menu";
import PHOTO_DIMS_JSON from "@/lib/photoDims.json";

/** Ürün fotoğraflarının GERÇEK ölçüleri (scripts/photo-dims.mjs üretir). */
const PHOTO_DIMS = PHOTO_DIMS_JSON as Record<string, { w: number; h: number }>;


/**
 * Yedek kart etiketi. Amaç: iki kart yan yana geldiğinde AYIRT EDİLEBİLSİN.
 *  - Parantez içi AYIRT EDİCİ olduğunda korunur: "Patates kızartması (el yapımı)"
 *    ve "(parmesanlı)" aynı ada sahip; parantez atılırsa ikisi de "PATATES
 *    KIZARTMASI" olup ayırt edilemiyordu.
 *  - Ana addan ilk iki kelime + parantezin ilk kelimesi alınır.
 *    "Patates kızartması (el yapımı)" → "PATATES · EL YAPIMI"
 *    "Patates kızartması (parmesanlı)" → "PATATES · PARMESANLI"
 *    "Sweet & chili" → "SWEET & CHILI" · "Su" → "SU"
 */
function shortLabel(name: string): string {
  const paren = name.match(/\(([^)]*)\)/)?.[1]?.trim() ?? "";
  const base = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const baseWords = base.split(" ").filter(Boolean);
  if (paren) {
    /* parantez varsa: ana addan 1 kelime + parantezin tamamı (kısa tutulur) */
    const head = baseWords[0] ?? base;
    return `${head} · ${paren}`.toLocaleUpperCase("tr-TR");
  }
  const take = baseWords.slice(0, 3).join(" ");
  return (take || base || "?").toLocaleUpperCase("tr-TR");
}

/** Kare ürün görseli: hero cutout → paylaşılan/ürün fotoğrafı → kısa ad rozeti. */
export default function ProductImage({ m, name, size = 96, big = false, eager = false }: { m: MenuItem; name: string; size?: number; big?: boolean; eager?: boolean }) {
  const src = m.hero ? CUTOUTS_M[m.id as HeroId] : undefined;
  /* 12 Eyl 2026: hero olmayan kalemler için m.photo (taco ve noodle'ın PAYLAŞTIĞI
     tek görsel — lib/menu SHARED_PHOTO). next/image genişlik/yükseklik istiyor;
     dosya 800×1200 üretildi.
     13 Eyl 2026: koşul `!src && m.photo` — yani hero OLUP da kesimi HENÜZ GELMEMİŞ
     ürün (citir) de buraya düşüyor. Önce `hero ? cutout : photo` dallanması vardı
     ve citir kesimi olmadığı için doğrudan baş harfe düşüyordu; fotoğrafı olduğu
     hâlde görünmüyordu. */
  if (!src && m.photo) {
    /* 20 Eyl 2026: içecek/yan görselleri GELDİ ve en-boy oranları birbirinden
       çok farklı (bitburger 134×480 ≈ 0.28, patates-peynirli 824×480 ≈ 1.72).
       Sabit 800×1200 vermek next/image'a yanlış intrinsic oran bildiriyordu:
       CSS `object-fit: contain` bozulmayı gizliyor ama ayrılan kutu ve srcset
       yanlış hesaplanıyor. Oran artık dosya adından türetilen tablodan
       (PHOTO_DIMS) geliyor; bilinmeyen dosya eski varsayılana düşer. */
    const d = PHOTO_DIMS[m.photo] ?? { w: 800, h: 1200 };
    return (
      <div className={"pimg" + (big ? " big" : "")}>
        <Image
          src={m.photo}
          alt=""
          width={d.w}
          height={d.h}
          sizes={big ? "(max-width: 640px) 90vw, 480px" : `${size}px`}
          loading={eager || big ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
        />
      </div>
    );
  }
  if (src) {
    return (
      <div className={"pimg" + (big ? " big" : "")}>
        <Image src={src} alt="" sizes={big ? "(max-width: 640px) 90vw, 480px" : `${size}px`} loading={eager || big ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
      </div>
    );
  }
  /* YEDEK GÖRÜNÜM — fotoğrafı olmayan kalemler (yan ürün, sos, içecek).
     Boş gri kutu ya da kırık görsel ikonu YOK: marka renklerinde bir blok içinde
     ürünün KISA ADI. Tek harf yetmiyordu — "Patates kızartması (el yapımı)" ve
     "(parmesanlı)" ikisi de "P", iki sos ikisi de "T" veriyordu; kartlar birbirinden
     ayırt edilemiyordu. shortLabel ilk iki anlamlı kelimeyi alır.
     Ölçü .pimg ile AYNI (96×96 / big 220px), yani fotoğraflı kartla yan yana
     dizilim bozulmaz.
     Fotoğraf eklendiğinde: dosyayı public/urun/<id>.webp olarak koymak yeterli —
     lib/cutouts-available.ts build'de bulur (hero) ya da menü kaydına photo
     eklenir; ProductImage sırası cutout > photo > yedek olduğu için burası
     kendiliğinden devre dışı kalır. Kod değişikliği gerekmez. */
  const label = shortLabel(name);
  return (
    <div className={"pimg typo" + (big ? " big" : "")} aria-hidden="true" data-fallback>
      <span className={label.length > 6 ? "long" : undefined}>{label}</span>
    </div>
  );
}
