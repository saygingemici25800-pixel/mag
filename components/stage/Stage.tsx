"use client";

import Link from "next/link";
import { preload } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { itemDesc, localePath } from "@/lib/i18n";
import { heroProducts, type ExtraCutouts } from "./cutouts";
import { splitTitle } from "@/lib/menu";
import { playStage, playSwitch, warmAudio } from "@/lib/sound";
import Arc from "./Arc";
import Claims from "./Claims";
import Hero from "./Hero";
import LightRays from "./LightRays";
import Outro from "./Outro";
import CUT_CENTERS from "@/lib/cutCenters.json";
import { LOGO } from "./logo";
import Preloader from "./Preloader";
import { useLoadProgress } from "./useLoadProgress";
import StaticFallback from "./StaticFallback";
import { CENTER, DEFAULT_ASPECT_MATH, N, SLIDE_MS, computeFrame, slideEase } from "./stageMath";
import { useScrollProgress } from "./useScrollProgress";
import "./stage.css";

const SWIPE_PX = 44;
const HERO_ZONE = 0.05; // ok/klavye/sürükleme yalnızca hero bölgesinde (scrollY ≤ max·.05)

type El = HTMLElement | null;

/**
 * Ana sayfa sinematik sahnesi. `.scroller` 1200vh, `.stage` fixed.
 * Her karede `computeFrame(p)` → DOM'a doğrudan yazılır (React state yalnızca `active` ve `ci` için).
 */
export default function Stage({ extra }: { extra?: ExtraCutouts }) {
  const t = useT();
  const locale = useLocale();
  /* sahnede dönen ürünler: menu.ts'ten fotoğrafı olanlar (şu an 5; fotoğraf gelince kendiliğinden büyür) */
  const list = heroProducts(extra);
  const count = list.length;
  const [active, setActive] = useState(0); // slot dizilimi (geçiş bitince kayar)
  const [shown, setShown] = useState(0); // başlık / harfler / aksan: geçiş başlar başlamaz hedef ürün
  const [ci, setCi] = useState(-1);
  const [flowSide, setFlowSide] = useState<"left" | "right">("left");
  const sideRef = useRef<"left" | "right">("left");
  const shownRef = useRef(0);
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

  /** İsimle DOM referansı bağla — her isim için sabit callback (ref churn olmasın). Düz nesne: render'da okunabilir.
      React bir düğümü yeniden oluşturursa (ör. ci değişince Claims) o ismin stil önbelleği geçersiz kılınır;
      yoksa "zaten yazıldı" sanılıp yeni düğüme opaklık/transform hiç yazılmaz. */
  const [dom] = useState(() => {
    const els: Record<string, El> = {};
    const binders: Record<string, (el: El) => void> = {};
    const onRebind: ((name: string) => void)[] = [];
    return {
      bind: (name: string) =>
        (binders[name] ??= (el: El) => {
          const prev = els[name];
          els[name] = el;
          if (el && el !== prev) onRebind.forEach((f) => f(name));
        }),
      get: (name: string): El => els[name] ?? null,
      onRebind: (f: (name: string) => void) => onRebind.push(f),
    };
  });
  const { bind } = dom;

  useEffect(() => {
    // yeni DOM düğümü bağlandığında o isme ait stil önbelleğini düşür
    dom.onRebind((name) => {
      const prefix = name + "|";
      for (const k of styleCache.current.keys()) if (k.startsWith(prefix)) styleCache.current.delete(k);
    });
  }, [dom]);

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

  /** slot başına en/boy oranı (kart içindeki contain kutusu; data-ar) + görsel ağırlık merkezi (cutCenters.json) — layout okuması yok */
  const slotBoxes = useRef<{ ar: number; cx: number }[]>([]);
  const styleCache = useRef(new Map<string, string>());
  const measureCutout = useCallback(() => {
    slotBoxes.current = Array.from({ length: N }, (_, i) => {
      const el = dom.get(`item${i}`);
      const id = el?.dataset.k ?? "";
      return { ar: parseFloat(el?.dataset.ar ?? "") || DEFAULT_ASPECT_MATH, cx: (CUT_CENTERS as Record<string, { cx: number }>)[id]?.cx ?? 0.5 };
    });
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
    // slotlar kaydı: yeni ürünlerin en/boy oranını al
    measureCutout();
  }, [active, measureCutout]);

  // unmount: html üzerindeki sahne izlerini temizle
  useEffect(
    () => () => {
      document.documentElement.classList.remove("lm");
      document.documentElement.classList.remove("heroOn");
    },
    [],
  );

  const render = useCallback(
    (p: number) => {
      const { vw, vh } = size.current;
      const it = list[shownRef.current];
      const root = document.documentElement;

      /* ok geçişi: offset 0→±1, 480 ms; bitince ±1'de bekler, slotlar kayınca (useLayoutEffect) 0 olur */
      const sl = slide.current;
      if (sl && !sl.done) {
        const k = Math.min((performance.now() - sl.start) / SLIDE_MS, 1);
        offsetRef.current = sl.dir * slideEase(k);
        if (k >= 1) {
          offsetRef.current = sl.dir;
          sl.done = true;
          setActive((a) => (a + sl.dir + count) % count);
        }
      }

      const f = computeFrame(
        p,
        {
          vw,
          vh,
          slots: slotBoxes.current,
        },
        offsetRef.current,
      );

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

      /* aydınlık bölüm (manifesto): tek palet — zemin gradyanının üstüne limon perde, gücü f.bright (0→1→0) */
      st("bgBright", "opacity", f.bright.toFixed(3));
      root.classList.toggle("lm", f.lm);
      /* hero'da üst çubuk logosu armatürün kubbesiyle çakışır; armatürde MAG zaten var → gizle */
      root.classList.toggle("heroOn", f.hero > 0.5);

      for (let i = 0; i < N; i++) {
        const n = `item${i}`;
        st(n, "transform", f.items[i].transform);
        st(n, "opacity", f.items[i].opacity);
        st(n, "filter", f.items[i].filter);
        st(n, "z-index", f.items[i].z);
        /* karartma filtreyle değil: siyah silüet üstünde görselin (ve yansımasının) opaklığı */
        st(`img${i}`, "opacity", f.items[i].bright);
        st(`rimg${i}`, "opacity", f.items[i].bright);
        /* |p|≥3 kartlarda yansıma hiç çizilmez (perf: maske + blur) */
        st(n, "--refl", f.items[i].refl ? "block" : "none");
      }

      /* Yan oklar: görünürlük + ÇALIŞMA ZAMANINDA konum. Yatay uzaklık odaktaki ürünün
         sınır kutusundan gelir (stageMath: arrows.gap), dikeyde ürünün ortası (%48). */
      const pe = f.arrows.opacity > 0.5 ? "auto" : "none";
      for (const a of ["arrowL", "arrowR"]) {
        st(a, "opacity", f.arrows.opacity);
        st(a, "pointer-events", pe);
        st(a, "--arrowGap", `${f.arrows.gap.toFixed(1)}px`);
        st(a, "--arrowY", `${f.arrows.cy.toFixed(1)}px`);
      }
      /* ışık konisi: opaklık + kaynak konumu (LightRays her karede --rayY okur) */
      st("rays", "opacity", f.rays);
      st("rays", "--rayY", f.raysOriginY.toFixed(3));
      st("cta", "opacity", f.cta);
      st("cta", "pointer-events", f.cta > 0.5 ? "auto" : "none");

      st("scHero", "opacity", f.hero);
      st("scDive", "opacity", f.dive);
      st("rail", "opacity", f.dive);
      st("scPay", "opacity", f.pay);
      st("scFaq", "opacity", f.faq.opacity);
      st("scFaq", "transform", `translateY(${f.faq.ty.toFixed(1)}px) scale(${f.faq.scale.toFixed(3)})`);
      st("scFaq", "filter", `brightness(${f.faq.brightness.toFixed(3)})`);
      st("faqInner", "transform", `translateY(${f.faq.innerTy.toFixed(2)}%)`);
      st("scFoot", "opacity", f.foot.opacity);
      st("scFoot", "transform", `translateY(${f.foot.ty.toFixed(1)}px)`);
      st("scFoot", "--footBg", f.foot.bg.toFixed(3));
      st("footInner", "transform", `translateY(${f.foot.innerTy.toFixed(2)}%)`);
      st("panelVeil", "opacity", f.panelVeil);
      st("track", "opacity", f.track);
      st("counter", "opacity", f.track);

      if (f.flow.side !== sideRef.current) {
        sideRef.current = f.flow.side;
        setFlowSide(f.flow.side);
      }
      if (f.ci !== ciRef.current) {
        /* aşama değişiminde kısa "stage" sesi */
        if (f.ci >= 0 && ciRef.current >= 0) playStage();
        ciRef.current = f.ci;
        setCi(f.ci);
      }
    },
    [dom, list, count],
  );

  // Preloader kalkana kadar sahne rAF'ı çalışmaz (CPU); ilk kare yine de bir kez çizilir (aşağıda)
  useScrollProgress(render, !reduced && preDone);

  /* ilk render adımı: preloader dururken sahnenin ilk karesini YALNIZCA bir kez çiz.
     (Efekt her render'da yeniden koşarsa scroll konumu p=0'a çekilir; ok tıklaması bunu tetikliyordu.) */
  const firstPaintDone = useRef(false);
  useEffect(() => {
    if (reduced || preDone || firstPaintDone.current) return;
    const raf = requestAnimationFrame(() => {
      /* Bayrağı ancak kare gerçekten çizilince kaldır: efekt yeniden kurulursa (bağımlılık
         kimlikleri değişince) temizlik bekleyen rAF'ı iptal eder; bayrak baştan set edilseydi
         "firstRender" adımı bir daha hiç işaretlenmez ve preloader %75'te asılı kalırdı. */
      firstPaintDone.current = true;
      render(0);
      /* Adımı burada, senkron işaretle. Araya setTimeout girerse yeniden kurulan efektin
         temizliği onu iptal edebiliyor ve preloader hiç kalkmıyordu. */
      load.mark("firstRender");
    });
    return () => cancelAnimationFrame(raf);
  }, [reduced, preDone, render, load]);

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
    setShown((a) => (a + d + count) % count);
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

  /* reduced-motion: statik sahne, ama preloader yine var — blur/wipe yok, logo 300 ms fade-in,
     çizgi ilerler, aynı 2.4 s minimum (zaman tabanlı: gerçek adımlar bu dalda işaretlenmiyor) */
  if (reduced)
    return (
      <>
        <Preloader progress={1} label={t.pre.loading} onDone={() => setPreDone(true)} />
        <StaticFallback t={t} />
      </>
    );

  const it = list[shown];
  const [l1, l2] = splitTitle(it.name);

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
        <div className="bgBright" ref={bind("bgBright")} aria-hidden="true" />

        <LightRays bind={bind("rays")} onReady={() => load.mark("rays")} />
        <div className="panelVeil" ref={bind("panelVeil")} aria-hidden="true" />
        <Arc active={active} bind={bind} extra={extra} />

        <Hero bind={bind} l1={l1} l2={l2} k={it.id} index={shown} count={count} onPrev={() => go(-1)} onNext={() => go(1)} prevAria={t.hero.prevAria} nextAria={t.hero.nextAria} scrollHint={t.hero.hint} />

        <Claims
          item={it}
          desc={itemDesc(t, it) ?? it.desc}
          ci={ci}
          claims={t.claims}
          rail={t.rail}
          bind={bind}
          side={flowSide}
        />
        <Outro t={t} bind={bind} />

        <Link href={localePath(locale, "/siparis")} className="ctaPill" ref={bind("cta")} prefetch={false} tabIndex={-1}>
          {t.cta.order}
        </Link>
      </div>

      <Preloader progress={load.progress} label={t.pre.loading} onDone={() => setPreDone(true)} />
    </>
  );
}
