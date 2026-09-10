"use client";

import Link from "next/link";
import { useLocale, useT } from "@/components/LocaleProvider";
import { localePath } from "@/lib/i18n";
import PhotoWall from "./PhotoWall";
import "./gallery.css";

/**
 * GALERİ — tam ekran (100dvh), dikey sayfa scroll'u yok.
 *
 * Ana sayfanın scroll sahnesi, sabit katmanları, preloader ve döngüsü BURADA YOK:
 * o kurgu yalnızca components/stage/Stage.tsx içinde ve yalnızca ana sayfa rotasında
 * render ediliyor. Bu rota Stage'i hiç çağırmıyor, dolayısıyla ana sayfa kurgusu
 * bu sayfadan etkilenmez.
 */
export default function GalleryPage() {
  const t = useT();
  const locale = useLocale();
  const g = t.gallery;
  return (
    <main className="gpage">
      <PhotoWall />
      {/* okunabilirlik perdesi: tek renkten aşağı sönen yumuşak geçiş */}
      <div className="gveil" aria-hidden="true" />
      <div className="ghead">
        <h1>
          {g.title[0]}
          <br />
          {g.title[1]}
        </h1>
        <p>{g.lead}</p>
      </div>
      <Link href={localePath(locale, "/")} className="gback" prefetch={false}>
        ← {g.back}
      </Link>
      {/* mobilde yapışkan sipariş düğmesi (masaüstünde üst barda zaten var) */}
      <Link href={localePath(locale, "/siparis")} className="gorder" prefetch={false}>
        {t.chrome.menu}
      </Link>
    </main>
  );
}
