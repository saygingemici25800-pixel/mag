"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { itemDesc, localePath } from "@/lib/i18n";
import { HERO_ITEMS, splitTitle } from "@/lib/menu";
import { playSwitch } from "@/lib/sound";
import Arc from "./Arc";
import BigTitle from "./BigTitle";
import Claims from "./Claims";
import LightRays from "./LightRays";
import Outro from "./Outro";
import Preloader from "./Preloader";
import StaticFallback from "./StaticFallback";
import { computeFrame, N } from "./stageMath";
import { useScrollProgress } from "./useScrollProgress";
import "./stage.css";

const SWIPE_PX = 44;
const HERO_ZONE = 0.05; // ok/klavye/sürükleme yalnızca hero bölgesinde (scrollY ≤ max·.05)

type El = HTMLElement | null;

/**
 * Ana sayfa sinematik sahnesi. `.scroller` 1200vh, `.stage` fixed.
 * Her karede `computeFrame(p)` → DOM'a doğrudan yazılır (React state yalnızca `active` ve `ci` için).
 */
export default function Stage() {
  const t = useT();
  const locale = useLocale();
  const [active, setActive] = useState(0);
  const [ci, setCi] = useState(-1);
  const [reduced, setReduced] = useState(false);

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
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const on = () => {
      size.current = { vw: window.innerWidth, vh: window.innerHeight };
    };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

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
      const it = HERO_ITEMS[activeRef.current];
      const root = document.documentElement;
      root.style.setProperty("--accent", it.accent);

      const cimg = dom.get("centerImg") as HTMLImageElement | null;
      const f = computeFrame(p, {
        vw,
        vh,
        accent: it.accent,
        ch: cimg?.clientHeight ?? 0,
        cw: cimg?.clientWidth ?? 0,
      });

      /** DOM'a doğrudan yaz — React state değil (60fps). */
      const st = (name: string, prop: string, value: string | number) => {
        const el = dom.get(name);
        if (el) el.style.setProperty(prop, String(value));
      };

      st("stage", "background-color", f.bg);
      root.classList.toggle("lm", f.lm);

      for (let i = 0; i < N; i++) {
        const n = `item${i}`;
        st(n, "transform", f.items[i].transform);
        st(n, "opacity", f.items[i].opacity);
        st(n, "filter", f.items[i].filter);
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

  useScrollProgress(render, !reduced);

  /* hero: swap the focused product */
  const go = useCallback((d: number) => {
    setActive((a) => (a + d + N) % N);
    playSwitch();
  }, []);

  const inHeroZone = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return window.scrollY <= max * HERO_ZONE;
  };

  useEffect(() => {
    if (reduced) return;
    const onKey = (e: KeyboardEvent) => {
      if (!inHeroZone()) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, reduced]);

  if (reduced) return <StaticFallback t={t} />;

  const it = HERO_ITEMS[active];
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
        <div className="room" aria-hidden="true">
          <div className="toplight" />
          <div className="aura" ref={bind("aura")} />
          <div className="floor" ref={bind("floor")} />
          <div className="vign" />
        </div>

        <LightRays bind={bind("rays")} />

        <Arc active={active} bind={bind} />

        <div className="streak" aria-hidden="true">
          <b ref={bind("streak")} />
        </div>

        <div className="sideL" aria-hidden="true">
          {sideWord.split("").map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
        <div className="sideR" aria-hidden="true">
          {t.chrome.city.split("").map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>

        <section className="scene" ref={bind("scHero")}>
          <div className="heroCopy">
            <BigTitle as="h1" l1={l1} l2={l2} />
          </div>
        </section>

        <Claims item={it} desc={itemDesc(t, it) ?? it.desc} ci={ci} claims={t.claims} rail={t.rail} bind={bind} />
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

      <Preloader brand={t.preloader.brand} />
    </>
  );
}
