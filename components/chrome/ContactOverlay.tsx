"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";

/**
 * İLETİŞİM — aynı sayfada tam ekran katman. AYRI ROTA YOK: URL, scroll konumu ve sahne ilerlemesi (p)
 * hiç değişmez; kapanınca kaldığı yerden devam eder.
 *
 * Animasyon: saf Web Animations API (gsap YOK — ana sayfa bundle'ına girmesin).
 *  - 3 üst panel height→0 (1.6 s, expo.inOut, stagger .4), 3 alt panel width→0 (stagger amount .4,
 *    üst grubun bitişinden .8 s önce başlar); satırlar maskeli: y 100% + skewY 7° → 0 (1.8 s, power4.out,
 *    stagger amount .3); kapatma düğmesi daire çizilir, sonra çarpı. Kapanışta aynı çizelge tersine (2×).
 *  - prefers-reduced-motion: animasyon yok, anında açık/kapalı.
 * Davranış: html overflow kilidi (scrollY korunur), ESC / dışarı tıklama kapatır, odak tuzağı, kapanınca
 * odak İLETİŞİM düğmesine döner. Sahnenin ok tuşları katmana sızmaz (keydown yayılımı durdurulur).
 */
type State = "opening" | "open" | "closing";

const EXPO_INOUT = "cubic-bezier(0.87, 0, 0.13, 1)";
const POWER4_OUT = "cubic-bezier(0.19, 1, 0.22, 1)";
const PANEL_MS = 1600;
const PANEL_STAGGER = 400;
const BOT_AMOUNT = 400;
const OVERLAP = 800;
const LINE_MS = 1800;
const LINE_AMOUNT = 300;
const LINE_START = 400;
/** kapanış aynı çizelgenin tersi; 3.6 s'yi 2× hızlı oynatır (1.8 s) */
const CLOSE_RATE = 2;
const CIRC = 94.3; // 2π·15
const XLEN = 17;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ContactOverlay({ t }: { t: Messages["contact"] }) {
  const [state, setState] = useState<State | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const anims = useRef<Animation[]>([]);

  const close = useCallback(() => setState((s) => (s && s !== "closing" ? "closing" : s)), []);
  const inRef = useRef<HTMLDivElement>(null);
  /* "dışarı" tıklama: arka plan YA DA içerik kutusunun boş alanı (mobilde kutu tüm ekranı kaplar,
     bu yüzden yalnızca arka planı saymak yetmez). İçerikteki öğelere tıklama kapatmaz. */
  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === rootRef.current || e.target === inRef.current) close();
  };

  /* açılış çizelgesi */
  useEffect(() => {
    if (state !== "opening") return;
    const root = rootRef.current;
    if (!root) return;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    if (reduced()) {
      const id = window.setTimeout(() => setState("open"), 0);
      return () => window.clearTimeout(id);
    }
    const list: Animation[] = [];
    const tops = root.querySelectorAll<HTMLElement>(".cPanel.top");
    const bots = root.querySelectorAll<HTMLElement>(".cPanel.bot");
    tops.forEach((el, i) => list.push(el.animate([{ height: "100%" }, { height: "0%" }], { duration: PANEL_MS, delay: i * PANEL_STAGGER, easing: EXPO_INOUT, fill: "both" })));
    const botStart = PANEL_MS + (tops.length - 1) * PANEL_STAGGER - OVERLAP;
    const botStep = bots.length > 1 ? BOT_AMOUNT / (bots.length - 1) : 0;
    bots.forEach((el, i) => list.push(el.animate([{ width: "100%" }, { width: "0%" }], { duration: PANEL_MS, delay: botStart + i * botStep, easing: EXPO_INOUT, fill: "both" })));
    const lines = root.querySelectorAll<HTMLElement>(".cLine > *");
    const lineStep = lines.length > 1 ? LINE_AMOUNT / (lines.length - 1) : 0;
    lines.forEach((el, i) =>
      list.push(el.animate([{ transform: "translateY(100%) skewY(7deg)" }, { transform: "translateY(0) skewY(0deg)" }], { duration: LINE_MS, delay: LINE_START + i * lineStep, easing: POWER4_OUT, fill: "both" })),
    );
    const circle = root.querySelector<SVGCircleElement>(".cClose circle");
    if (circle) list.push(circle.animate([{ strokeDashoffset: CIRC }, { strokeDashoffset: 0 }], { duration: 900, delay: botStart, easing: POWER4_OUT, fill: "both" }));
    root.querySelectorAll<SVGLineElement>(".cClose line").forEach((l, i) =>
      list.push(l.animate([{ strokeDashoffset: XLEN }, { strokeDashoffset: 0 }], { duration: 350, delay: botStart + 700 + i * 120, easing: POWER4_OUT, fill: "both" })),
    );
    anims.current = list;
    let stale = false;
    Promise.all(list.map((a) => a.finished))
      .then(() => {
        if (!stale) setState((s) => (s === "opening" ? "open" : s));
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [state]);

  /* kapanış: çizelge tersine, bitince kaldır ve odağı geri ver */
  useEffect(() => {
    if (state !== "closing") return;
    const finish = () => {
      document.documentElement.style.overflow = "";
      anims.current = [];
      setState(null);
      openerRef.current?.focus();
    };
    if (reduced() || !anims.current.length) {
      const id = window.setTimeout(finish, 0);
      return () => window.clearTimeout(id);
    }
    anims.current.forEach((a) => {
      a.playbackRate = -CLOSE_RATE;
      a.play();
    });
    let stale = false;
    Promise.all(anims.current.map((a) => a.finished))
      .then(() => !stale && finish())
      .catch(() => !stale && finish());
    return () => {
      stale = true;
    };
  }, [state]);

  /* güvenlik: bileşen açıkken kaldırılırsa kilidi bırak */
  useEffect(() => () => void (document.documentElement.style.overflow = ""), []);

  /* dokunmatik: html overflow kilidi iOS'ta yetmez — içerik alanı dışında touchmove'u engelle */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !state) return;
    const onTouch = (e: TouchEvent) => {
      if (!(e.target as Element | null)?.closest(".cIn")) e.preventDefault();
    };
    root.addEventListener("touchmove", onTouch, { passive: false });
    return () => root.removeEventListener("touchmove", onTouch);
  }, [state]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    /* sahnenin window dinleyicileri (ok tuşları → ürün değişimi) katmana sızmasın */
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      const root = rootRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if ([" ", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      /* sayfa kaydırma tuşları ve sahne okları: katman açıkken hiçbir şey yapmasın */
      if ((e.target as HTMLElement).tagName !== "A" || e.key !== " ") e.preventDefault();
    }
  };

  const minutes = t.minutes;
  return (
    <>
      <button ref={openerRef} type="button" className="cta" data-contact-open onClick={() => setState((s) => s ?? "opening")} aria-haspopup="dialog" aria-expanded={state !== null}>
        {t.open}
      </button>
      {state ? (
        <div ref={rootRef} className="contact" data-state={state} role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={onBackdrop} onKeyDown={onKeyDown}>
          {/* açılış panelleri: üst 3 (height→0), alt 3 (width→0); 768 px altında tek sütun */}
          <div className="cPanels" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={"t" + i} className="cCell top">
                <span className="cPanel top" />
              </span>
            ))}
            {[0, 1, 2].map((i) => (
              <span key={"b" + i} className="cCell bot">
                <span className="cPanel bot" />
              </span>
            ))}
          </div>

          <div ref={inRef} className="cIn">
            <button ref={closeRef} type="button" className="cClose" onClick={close} aria-label={t.close}>
              <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
                <circle cx="16" cy="16" r="15" />
                <line x1="10" y1="10" x2="22" y2="22" />
                <line x1="22" y1="10" x2="10" y2="22" />
              </svg>
            </button>

            <h2 id="contact-title" className="cTitle cLine">
              <span>{t.title[0]}</span>
            </h2>

            <div className="cRows">
              <div className="cRow cLine">
                <span>
                  <b>{t.address}</b>
                  <a href={CONTACT.mapsUrl} data-maps target="_blank" rel="noopener noreferrer">
                    {CONTACT.address}
                  </a>
                </span>
              </div>
              <div className="cRow cLine">
                <span>
                  <b>{t.phone}</b>
                  {/* AÇIK — işletme verecek */}
                  {CONTACT.phone ? <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}>{CONTACT.phone}</a> : <em>{t.pending}</em>}
                </span>
              </div>
              <div className="cRow cLine">
                <span>
                  <b>{t.hours}</b>
                  {/* AÇIK — çalışma saatleri */}
                  {CONTACT.hours ? <i>{CONTACT.hours}</i> : <em>{t.pending}</em>}
                </span>
              </div>
              <div className="cRow cLine">
                <span>
                  <b>{t.social}</b>
                  <i className="cSocial">
                    <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">
                      {t.instagram}
                    </a>
                    <s aria-hidden="true">·</s>
                    {/* AÇIK — TikTok */}
                    {CONTACT.tiktok ? (
                      <a href={CONTACT.tiktok} target="_blank" rel="noopener noreferrer">
                        {t.tiktok}
                      </a>
                    ) : (
                      <em>
                        {t.tiktok} {t.pending}
                      </em>
                    )}
                  </i>
                </span>
              </div>
            </div>

            <section className="cWalk" aria-labelledby="contact-walk">
              <h3 id="contact-walk" className="cLine">
                <span>{t.walk}</span>
              </h3>
              <ul>
                {/* süreler AÇIK / yer tutucu — lib/contact.ts */}
                {CONTACT.walking.map((w) => (
                  <li key={w.place} className="cLine">
                    <span>
                      <b>{w.place}</b>
                      <em>
                        {w.minutes} {minutes}
                      </em>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="cLine cMapsWrap">
              <span>
                <a className="cMaps" data-maps href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
                  {/* konum pini — inline SVG, harici ikon kütüphanesi yok */}
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" fill="currentColor" />
                  </svg>
                  {t.directions}
                </a>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
