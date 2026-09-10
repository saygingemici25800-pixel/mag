"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { COLS, GALLERY, ROWS, tileIndex } from "@/lib/gallery";
import { findMenuItem } from "@/lib/orders-shared";
import "./gallery.css";

/**
 * Sürüklenebilir sonsuz foto duvarı — infinite-drag-scroll deseninin bu siteye uyarlaması.
 *
 * REFERANSTAN AYRILAN YEDİ NOKTA:
 *  1) window'da wheel dinleyicisi YOK. Gezinme yalnızca sürükleme + klavye.
 *  2) rowVariants'taki Math.random() YOK: gecikme indeksten türer (deterministik), yani
 *     sunucu ve istemci aynı sonucu üretir (hidrasyon uyuşmazlığı olmaz). Toplam giriş 0,8 sn.
 *  3) Ham hex yok: renkler globals.css tokenlarından (gallery.css).
 *  4) polaroid varyantı yok.
 *  5) class-variance-authority kurulmadı.
 *  6) Yeni paket kurulmadı: GSAP zaten projede; Draggable + InertiaPlugin (ikisi de
 *     node_modules/gsap içinde geliyor) kullanılıyor, momentum elle yazılmadı.
 *  7) cn yardımcısı yok, sınıflar düz birleştiriliyor.
 *
 * Dört kopya döşeme YAPISAL: duvar 2×2 kopyadan oluşur, sürükleme sırasında konum bir
 * kopya boyutuna göre sarmalanır (wrap), böylece hiçbir yönde boşluk görünmez.
 */
export default function PhotoWall() {
  const t = useT();
  const g = t.gallery;
  const viewRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  /* Izgara ölçüsü ÇALIŞMA ZAMANINDA: bir KOPYA ekrandan büyük olmalı, yoksa sarmalama
     sırasında boşluk görünür (ölçüldü: sabit 5×3 ızgarada 390×844 ekranda kopya 566×340
     kalıyor ve alt yarı boş çıkıyordu). Sunucuda varsayılan basılır, istemcide düzeltilir;
     ikisi de aynı DOM yapısını üretir, yalnızca sayı değişir. */
  const [grid, setGrid] = useState({ cols: COLS, rows: ROWS });

  /* Ekranı kaplayacak sütun/satır sayısı: karo + boşluk ölçüsünden. */
  useEffect(() => {
    const calc = () => {
      const el = viewRef.current;
      if (!el) return;
      const cs = getComputedStyle(el.closest(".gpage") ?? el);
      const tile = parseFloat(cs.getPropertyValue("--gtile")) || 150;
      const gap = parseFloat(cs.getPropertyValue("--ggap")) || 10;
      const unit = tile + gap;
      /* +2 pay: kopya ekranı AŞMALI. +1 yeterli değildi — clamp(...vw) yüzünden gerçek karo
         tahminden küçük çıkıyor ve mobilde kopya ekrandan ~40 px kısa kalıyordu (ölçüldü). */
      setGrid({
        cols: Math.max(COLS, Math.ceil(window.innerWidth / unit) + 2),
        rows: Math.max(ROWS, Math.ceil(window.innerHeight / unit) + 2),
      });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const wall = wallRef.current;
    if (!view || !wall) return;
    let dragInst: { kill: () => void }[] = [];
    let cancelled = false;

    (async () => {
      const [{ gsap }, { Draggable }, inertia] = await Promise.all([
        import("gsap"),
        import("gsap/Draggable"),
        import("gsap/InertiaPlugin").catch(() => null),
      ]);
      if (cancelled) return;
      const InertiaPlugin = inertia?.InertiaPlugin;
      gsap.registerPlugin(Draggable, ...(InertiaPlugin ? [InertiaPlugin] : []));

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      /* Bir KOPYANIN boyutu: duvar 2×2 kopya olduğu için yarısı. Sarmalama bu değere göre. */
      const unitX = () => wall.offsetWidth / 2;
      const unitY = () => wall.offsetHeight / 2;
      /* Konumu her zaman [-unit, 0) aralığında tut: kenardan çıkan taraf öbür uçtan girer. */
      const wrap = (v: number, unit: number) => {
        if (unit <= 0) return 0;
        return ((v % unit) - unit) % unit;
      };

      const pos = { x: -unitX() / 2, y: -unitY() / 2 };
      const apply = () => {
        gsap.set(wall, { x: wrap(pos.x, unitX()), y: wrap(pos.y, unitY()) });
      };
      apply();
      setReady(true);

      /* Sürükleme: proxy üzerinde, çünkü asıl duvarın transform'unu biz sarmalıyoruz.
         Draggable'ın kendi x/y'si serbest artar; her karede wrap edilmiş hali yazılır. */
      const proxy = document.createElement("div");
      const inst = Draggable.create(proxy, {
        trigger: view,
        type: "x,y",
        /* touch-action'ı CSS'e bırakmıyoruz: kütüphane satır içi ezebiliyor.
           allowNativeTouchScrolling=false + dokunma ekseni serbest = sayfa kaymaz,
           duvar iki eksende de sürüklenir. */
        allowNativeTouchScrolling: false,
        allowContextMenu: true,
        inertia: !reduced && !!InertiaPlugin,
        /* mobilde momentum daha kısa */
        resistance: window.innerWidth < 900 ? 0.85 : 0.45,
        maxDuration: window.innerWidth < 900 ? 0.7 : 1.2,
        cursor: "grab",
        activeCursor: "grabbing",
        onPress() {
          gsap.killTweensOf(pos);
        },
        onDrag() {
          pos.x += this.deltaX;
          pos.y += this.deltaY;
          apply();
        },
        onThrowUpdate() {
          pos.x += this.deltaX;
          pos.y += this.deltaY;
          apply();
        },
      });
      dragInst = inst;

      /* Klavye: ok tuşlarıyla kaydırma (zorunlu). Sürükleme jestinin karşılığı. */
      const STEP = 120;
      const onKey = (e: KeyboardEvent) => {
        const map: Record<string, [number, number]> = {
          ArrowLeft: [STEP, 0],
          ArrowRight: [-STEP, 0],
          ArrowUp: [0, STEP],
          ArrowDown: [0, -STEP],
        };
        const d = map[e.key];
        if (!d) return;
        e.preventDefault();
        if (reduced) {
          pos.x += d[0];
          pos.y += d[1];
          apply();
          return;
        }
        gsap.to(pos, { x: pos.x + d[0], y: pos.y + d[1], duration: 0.32, ease: "power2.out", onUpdate: apply, overwrite: true });
      };
      view.addEventListener("keydown", onKey);

      const onResize = () => apply();
      window.addEventListener("resize", onResize);

      return () => {
        view.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", onResize);
      };
    })();

    return () => {
      cancelled = true;
      for (const d of dragInst) d.kill();
    };
  }, []);

  /* Alt metin: ürün biliniyorsa adından, bilinmiyorsa ortak yedek. Tahmin YOK. */
  const altOf = (item?: string) => {
    if (!item) return g.altFallback;
    const m = findMenuItem(item);
    return m ? g.altOf.replace("{name}", m.name) : g.altFallback;
  };

  const total = GALLERY.length;
  return (
    <div
      className={"gwall-view" + (ready ? " ready" : "")}
      ref={viewRef}
      tabIndex={0}
      role="application"
      aria-label={g.wallAria}
      data-gallery-view
    >
      <div className="gwall" ref={wallRef} data-gallery-wall>
        {[0, 1, 2, 3].map((copy) => (
          <div className="gwall-copy" key={copy} style={{ ["--gcols" as string]: grid.cols }} aria-hidden={copy > 0 || undefined}>
            {Array.from({ length: grid.cols * grid.rows }, (_, i) => {
              const photo = GALLERY[tileIndex(copy, i, total, grid.cols)];
              /* Deterministik stagger: satır+sütun toplamına göre, toplam ≤0,8 sn.
                 Math.random() YOK — sunucu/istemci aynı değeri üretir. */
              const step = (i % grid.cols) + Math.floor(i / grid.cols);
              const delay = Math.min(0.5, (step / Math.max(1, grid.cols + grid.rows - 2)) * 0.5);
              return (
                <figure className="gtile" key={i} style={{ animationDelay: `${delay.toFixed(3)}s` }}>
                  <Image
                    src={photo.src}
                    alt={copy === 0 ? altOf(photo.item) : ""}
                    width={photo.w}
                    height={photo.h}
                    /* servis genişliği karo boyutunu geçmesin */
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                    /* duvar sarmalanmış konumda başlar: hangi karonun görüneceği belli
                       değil, o yüzden hepsi lazy — körlemesine eager verilmiyor */
                    loading="lazy"
                    quality={70}
                    draggable={false}
                    className="gimg"
                  />
                </figure>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
