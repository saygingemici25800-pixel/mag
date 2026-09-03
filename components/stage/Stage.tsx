"use client";

import Link from "next/link";
import { preload } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { itemDesc, localePath } from "@/lib/i18n";
import type { StageMap } from "@/lib/katman";
import type { ExtraCutouts } from "./cutouts";
import { STAGE_KEYS } from "@/lib/menu";
import { HERO_ITEMS, splitTitle } from "@/lib/menu";
import { playSwitch, warmAudio } from "@/lib/sound";
import Arc from "./Arc";
import BigTitle from "./BigTitle";
import Claims from "./Claims";
import LightRays from "./LightRays";
import Outro from "./Outro";
import { LOGO } from "./logo";
import Preloader from "./Preloader";
import { useLoadProgress } from "./useLoadProgress";
import StaticFallback from "./StaticFallback";
import CrossFade from "./CrossFade";
import { SLIDE_MS, computeFrame, N, slideEase } from "./stageMath";
import { useScrollProgress } from "./useScrollProgress";
import "./stage.css";

const SWIPE_PX = 44;
const HERO_ZONE = 0.05; // ok/klavye/sürükleme yalnızca hero bölgesinde (scrollY ≤ max·.05)

type El = HTMLElement | null;

/**
 * Ana sayfa sinematik sahnesi. `.scroller` 1200vh, `.stage` fixed.
 * Her karede `computeFrame(p)` → DOM'a doğrudan yazılır (React state yalnızca `active` ve `ci` için).
 */
export default function Stage({ stages, extra }: { stages?: StageMap; extra?: ExtraCutouts }) {
  const t = useT();
  const locale = useLocale();
  const [active, setActive] = useState(0); // slot dizilimi (geçiş bitince kayar)
  const [shown, setShown] = useState(0); // başlık / harfler / aksan: geçiş başlar başlamaz hedef ürün
  const [ci, setCi] = useState(-1);
  const shownRef = useRef(0);
  const bgFrom = useRef(0); // gradyan crossfade'inin eski ürünü
  const slide = useRef<{ dir: number; start: number; done: boolean } | null>(null);
  const offsetRef = useRef(0);
  const queue = useRef<number[]>([]);
  const [reduced, setReduced] = useState(false);
  const [preDone, setPreDone] = useState(false);
  const load = useLoadProgress();
  // logo ilk boyamada hazır olsun (preloader'ın tek görseli)
  preload(LOGO.src, { as: "image", fetchPriority: "high" });

  const activeRef = useRef(0);
  const ciRef = useRef(-1);
  const size = useRef({ vw: 1440, vh: 860 });
  const swipe = useRef({ down: false, sx: 0 });

  /** İsimle DOM referansı bağla — her isim için sabit callback (ref churn olmasın). Düz nesne: render'da okunabilir. */
  const [dom] = useState(() => {
    const els: Record<string, El> = {};
    const binders: Record<string, (el: El) => void> = {};
    return {
      bind: (name: string) =>
        (binders[name] ??= (el: El) => {
          els[name] = el;
        }),
      get: (name: string): El => els[name] ?? null,
    };
  });
  const { bind } = dom;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);


  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* Kare içinde layout okuması yok: odaktaki cutout ölçüsü resize'da, ürün değişiminde ve görsel yüklenince cache'lenir */
  const cut = useRef({ ch: 0, cw: 0 });
  const styleCache = useRef(new Map<string, string>());
  const measureCutout = useCallback(() => {
    const img = dom.get("centerImg") as HTMLImageElement | null;
    cut.current = { ch: img?.clientHeight ?? 0, cw: img?.clientWidth ?? 0 };
  }, [dom]);
  useEffect(() => {
    const on = () => {
      size.current = { vw: window.innerWidth, vh: window.innerHeight };
      measureCutout();
    };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [measureCutout]);
  useEffect(() => {
    // paint(): odaktaki slotun kaynağı değişti → yeni görsel yüklenince ölç (wide/normal yükseklik farkı)
    const img = dom.get("centerImg") as HTMLImageElement | null;
    if (!img) return;
    if (img.complete) measureCutout();
    else {
      img.addEventListener("load", measureCutout, { once: true });
      return () => img.removeEventListener("load", measureCutout);
    }
  }, [active, dom, measureCutout]);

  // unmount: html üzerindeki sahne izlerini temizle
  useEffect(
    () => () => {
      document.documentElement.classList.remove("lm");
      document.documentElement.style.removeProperty("--accent");
    },
    [],
  );

  const render = useCallback(
    (p: number) => {
      const { vw, vh } = size.current;
      const it = HERO_ITEMS[shownRef.current];
      const root = document.documentElement;
      root.style.setProperty("--accent", it.accent);

      /* ok geçişi: offset 0→±1, 480 ms; bitince ±1'de bekler, slotlar kayınca (useLayoutEffect) 0 olur */
      const sl = slide.current;
      if (sl && !sl.done) {
        const k = Math.min((performance.now() - sl.start) / SLIDE_MS, 1);
        offsetRef.current = sl.dir * slideEase(k);
        if (k >= 1) {
          offsetRef.current = sl.dir;
          sl.done = true;
          setActive((a) => (a + sl.dir + N) % N);
        }
      }

      const f = computeFrame(p, { vw, vh, accent: it.accent, ch: cut.current.ch, cw: cut.current.cw }, offsetRef.current);

      /** DOM'a doğrudan yaz — React state değil (60fps). Değişmeyen değere yazma (style invalidation yok). */
      const cache = styleCache.current;
      const st = (name: string, prop: string, value: string | number) => {
        const v = String(value);
        const k = name + "|" + prop;
        if (cache.get(k) === v) return;
        const el = dom.get(name);
        if (!el) return;
        el.style.setProperty(prop, v);
        cache.set(k, v);
      };

      st("stage", "background-color", f.bg);
      /* arka plan gradyanı: odaktaki ürün (A) → yeni ürün (B) 480 ms crossfade; güç f.grad (hero 1, yelpaze .7, dalış/iddia .35, sonra 0, kapanışta 1) */
      const bgIt = HERO_ITEMS[bgFrom.current];
      const bgTo = HERO_ITEMS[shownRef.current];
      const g1 = bgIt.bg ?? [bgIt.accent, "#14100F"];
      const g2 = bgTo.bg ?? [bgTo.accent, "#14100F"];
      st("bgA", "background-image", `linear-gradient(135deg, ${g1[0]}, ${g1[1]})`);
      st("bgB", "background-image", `linear-gradient(135deg, ${g2[0]}, ${g2[1]})`);
      const mixK = slide.current ? slideEase(Math.min((performance.now() - slide.current.start) / SLIDE_MS, 1)) : 1;
      st("bgA", "opacity", (f.grad * (1 - mixK)).toFixed(3));
      st("bgB", "opacity", (f.grad * mixK).toFixed(3));
      if (!slide.current && bgFrom.current !== shownRef.current) bgFrom.current = shownRef.current;
      root.classList.toggle("lm", f.lm);

      for (let i = 0; i < N; i++) {
        const n = `item${i}`;
        st(n, "transform", f.items[i].transform);
        st(n, "opacity", f.items[i].opacity);
        st(n, "filter", f.items[i].filter);
        st(n, "z-index", f.items[i].z);
      }

      st("discA", "opacity", f.discA);
      st("discB", "opacity", f.discB.opacity);
      st("discB", "top", f.discB.top + "px");
      st("discB", "transform", "scale(" + f.discB.scale + ")");

      /* oklar: odaktaki burgerin iki yanında, dikeyde tam ortasında */
      const ax = f.arrows.ax.toFixed(0);
      const ay = f.arrows.ay.toFixed(0) + "px";
      const pe = f.arrows.opacity > 0.5 ? "auto" : "none";
      st("arrowL", "left", "calc(50% - " + ax + "px)");
      st("arrowR", "left", "calc(50% + " + ax + "px)");
      for (const a of ["arrowL", "arrowR"]) {
        st(a, "top", ay);
        st(a, "opacity", f.arrows.opacity);
        st(a, "pointer-events", pe);
      }

      st("dotsL", "opacity", f.dots);
      st("dotsR", "opacity", f.dots);
      st("floor", "opacity", f.floor);
      st("aura", "opacity", f.aura);
      st("rays", "opacity", f.rays);
      st("cta", "opacity", f.cta);
      st("cta", "pointer-events", f.cta > 0.5 ? "auto" : "none");

      st("scHero", "opacity", f.hero);
      st("scDive", "opacity", f.dive);
      st("rail", "opacity", f.dive);
      st("scPay", "opacity", f.pay);
      st("scFaq", "opacity", f.faq);
      st("scFoot", "transform", "translateY(" + f.foot.ty.toFixed(1) + "px)");
      st("scFoot", "opacity", f.foot.opacity);
      st("knob", "left", f.knob + "%");
      st("track", "opacity", f.track);
      st("streak", "left", f.streak + "%");
      st("hint", "opacity", f.hint);

      if (f.ci !== ciRef.current) {
        ciRef.current = f.ci;
        setCi(f.ci);
      }
    },
    [dom],
  );

  // Preloader kalkana kadar sahne rAF'ı çalışmaz (CPU); ilk kare yine de bir kez çizilir (aşağıda)
  useScrollProgress(render, !reduced && preDone);

  /* ilk render adımı: preloader dururken sahnenin ilk karesini bir kez çiz */
  useEffect(() => {
    if (reduced) return;
    let done = 0;
    const raf = requestAnimationFrame(() => {
      render(0);
      done = window.setTimeout(() => load.mark("firstRender"), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [reduced, render, load]);

  /* Preloader süresinde 5 cutout'u (ve yansımaları) decode et: ilk kaydırmada ana iş parçacığında decode takılması olmasın */
  useEffect(() => {
    if (reduced) return;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".item img"));
    let cancelled = false;
    Promise.allSettled(imgs.map((img) => (img.decode ? img.decode() : Promise.resolve()))).then(() => {
      if (cancelled) return;
      measureCutout();
      load.mark("cutouts");
    });
    return () => {
      cancelled = true;
    };
  }, [reduced, measureCutout, load]);

  /* hero: ok/klavye/sürükleme → kayarak geçiş; sürerken istekler kuyruğa */
  const startSlide = (d: number) => {
    slide.current = { dir: d, start: performance.now(), done: false };
    setShown((a) => (a + d + N) % N);
    playSwitch();
  };
  const go = (d: number) => {
    if (slide.current) {
      if (queue.current.length < 4) queue.current.push(d);
      return;
    }
    startSlide(d);
  };
  // geçiş bitti + slotlar kaydı: offset'i aynı karede sıfırla (görsel fark yok), kuyruktakini başlat
  useLayoutEffect(() => {
    if (slide.current?.done) {
      slide.current = null;
      offsetRef.current = 0;
      bgFrom.current = shownRef.current;
      const next = queue.current.shift();
      if (next !== undefined) startSlide(next);
    }
  }, [active]);

  const inHeroZone = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return window.scrollY <= max * HERO_ZONE;
  };

  useEffect(() => {
    if (reduced) return;
    const warm = () => warmAudio();
    window.addEventListener("pointerdown", warm, { once: true, passive: true });
    window.addEventListener("keydown", warm, { once: true });
    const onKey = (e: KeyboardEvent) => {
      if (!inHeroZone()) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go ref'ler üzerinden çalışır; yalnızca reduced değişince
  }, [reduced]);

  if (reduced) return <StaticFallback t={t} />;

  const it = HERO_ITEMS[shown];
  const [l1, l2] = splitTitle(it.name);
  const claim = ci >= 0 ? t.claims[ci] : null;
  const sideWord = (claim ? claim.l2 : l2 || l1).replace(/\s/g, "").slice(0, 6);

  return (
    <>
      <div className="scroller" aria-hidden="true" />

      <div
        className="stage"
        ref={bind("stage")}
        onPointerDown={(e) => {
          if (inHeroZone()) swipe.current = { down: true, sx: e.clientX };
        }}
        onPointerUp={(e) => {
          if (!swipe.current.down) return;
          swipe.current.down = false;
          const dx = e.clientX - swipe.current.sx;
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="bgGrad" ref={bind("bgA")} aria-hidden="true" />
        <div className="bgGrad" ref={bind("bgB")} aria-hidden="true" />
        <div className="bgVeil" aria-hidden="true" />
        <div className="room" aria-hidden="true">
          <div className="toplight" />
          <div className="aura" ref={bind("aura")} />
          <div className="floor" ref={bind("floor")} />
          <div className="vign" />
        </div>

        <LightRays bind={bind("rays")} onReady={() => load.mark("rays")} />

        <Arc active={active} bind={bind} extra={extra} />

        <div className="streak" aria-hidden="true">
          <b ref={bind("streak")} />
        </div>

        <div className="sideL" aria-hidden="true">
          <CrossFade k={sideWord}>
            {sideWord.split("").map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </CrossFade>
        </div>
        <div className="sideR" aria-hidden="true">
          {t.chrome.city.split("").map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>

        <section className="scene" ref={bind("scHero")}>
          <div className="heroCopy">
            <CrossFade k={it.id}>
              <BigTitle as="h1" l1={l1} l2={l2} />
            </CrossFade>
          </div>
        </section>

        <Claims
          item={it}
          desc={itemDesc(t, it) ?? it.desc}
          ci={ci}
          claims={t.claims}
          rail={t.rail}
          bind={bind}
          stageImage={ci >= 0 ? stages?.[it.id]?.[STAGE_KEYS[ci]] : undefined}
        />
        <Outro t={t} bind={bind} />

        <div className="track" ref={bind("track")} aria-hidden="true">
          <span className="knob" ref={bind("knob")} />
        </div>

        <button
          type="button"
          className="arrow l"
          ref={bind("arrowL")}
          aria-label={t.hero.prevAria}
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="k">{t.hero.prev}</span>
        </button>
        <button
          type="button"
          className="arrow r"
          ref={bind("arrowR")}
          aria-label={t.hero.nextAria}
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span className="k">{t.hero.next}</span>
        </button>

        <div className="hint" ref={bind("hint")}>
          {t.hero.hint}
        </div>

        <Link href={localePath(locale, "/siparis")} className="ctaPill" ref={bind("cta")} prefetch={false} tabIndex={-1}>
          {t.cta.order}
        </Link>
      </div>

      <Preloader progress={load.progress} slow={load.slow} onDone={() => setPreDone(true)} />
    </>
  );
}
