"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Üst çubuktaki SİPARİŞ düğmesi — İLETİŞİM ile bir çift.
 *
 * Neden istemci bileşeni: "sipariş kapalı" durumu panelden anlık değişir; ana sayfa ise statik
 * ön-render'lı. Chrome'u async yapmak tüm layout'u dinamikleştirir ve statikliği bozardı, bu
 * yüzden durum yalnızca burada, bağlanmadan sonra çekilir. İlk boyada düğme AÇIK görünür
 * (iyimser): kapalıyken bile /siparis sayfası açılır ve orada zaten "kapalıyız" uyarısı vardır,
 * yani yanlış tarafa düşen tek şey bir saniyelik görsel durumdur.
 *
 * Yönlendirme her koşulda /siparis (localePath ile dil ön eki).
 */
export default function OrderCta({ locale, label, labelShort, closedLabel, closedShort }: { locale: Locale; label: string; labelShort: string; closedLabel: string; closedShort: string }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () => {
      fetch("/api/panel/settings", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (alive && s && typeof s.ordering_open === "boolean") setClosed(!s.ordering_open);
        })
        .catch(() => {});
    };
    read();
    /* Sekmeye dönünce tazele: dükkân kapanmışsa düğme bayat kalmasın. */
    const onVis = () => document.visibilityState === "visible" && read();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (closed) {
    /* Pasif görünüm ama ÖLÜ DEĞİL: /siparis'e gider, çünkü müşteri menüye bakmak isteyebilir.
       aria-disabled ile ekran okuyucuya durum bildirilir (link'te disabled yoktur). */
    return (
      <Link
        href={localePath(locale, "/siparis")}
        className="cta cta-order is-closed"
        prefetch={false}
        aria-disabled="true"
        aria-label={closedLabel}
        data-order-cta
        data-closed="1"
      >
        {/* İki etiket de basılır, CSS genişliğe göre birini gösterir. Ekran okuyucu her
            koşulda TAM cümleyi duyar (aria-label), çünkü "Kapalıyız" tek başına eksik kalır. */}
        <span className="cta-long" aria-hidden="true">{closedLabel}</span>
        <span className="cta-short" aria-hidden="true">{closedShort}</span>
      </Link>
    );
  }

  return (
    <Link href={localePath(locale, "/siparis")} className="cta cta-order" prefetch={false} aria-label={label} data-order-cta>
      {/* Rusça "Заказать" mobilde 142 px tutup ekrandan taşıyordu; dar ekranda kısa karşılık
          ("Заказ") gösterilir, ekran okuyucu aria-label'dan TAM etiketi duyar.
          TR/EN'de kısa = uzun olduğu için görünüm hiç değişmez. */}
      <span className="cta-long" aria-hidden="true">{label}</span>
      <span className="cta-short" aria-hidden="true">{labelShort}</span>
    </Link>
  );
}
