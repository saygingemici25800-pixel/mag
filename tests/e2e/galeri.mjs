// Galeri — sürüklenebilir sonsuz foto duvarı
//  - /galeri · /en/gallery · /ru/galereya karşılıklı çalışır, hreflang üçlü
//  - duvar her genişlikte sürüklenir, sarmalama kesintisiz (hiçbir yönde boşluk yok)
//  - window'da wheel dinleyicisi YOK, Math.random() YOK, hidrasyon uyarısı yok
//  - klavye ok tuşları çalışır, odak görünür
//  - reduced-motion: giriş ve momentum kapalı, duvar hâlâ kullanılabilir
//  - ham hex yok, sabit metin sözlükte
//  - ana sayfa sahnesi bu rotada RENDER EDİLMEZ
import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik ---- */
const wallSrc = readFileSync(path.join(root, "components/gallery/PhotoWall.tsx"), "utf8");
const cssSrc = readFileSync(path.join(root, "components/gallery/gallery.css"), "utf8");
const cfgSrc = readFileSync(path.join(root, "lib/gallery.ts"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

/* Yorumları çıkar: kaynakta "Math.random() YOK" gibi AÇIKLAMALAR var, kodu ararken
   bunlar eşleşmesin. */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const wallCode = strip(wallSrc), cfgCode = strip(cfgSrc), cssCode = strip(cssSrc);
check("Math.random() kullanılmıyor", !/Math\.random/.test(wallCode + cfgCode));
check("window'da wheel dinleyicisi yok (kaynak)", !/window\.addEventListener\(\s*["']wheel/.test(wallCode));
check("class-variance-authority kurulmadı", !pkg.dependencies?.["class-variance-authority"] && !pkg.devDependencies?.["class-variance-authority"]);
check("ikinci animasyon paketi kurulmadı", !pkg.dependencies?.["framer-motion"] && !pkg.dependencies?.["motion"] && !!pkg.dependencies?.gsap, `gsap ${pkg.dependencies?.gsap}`);
check("polaroid varyantı yok", !/polaroid/i.test(wallCode + cssCode));
/* ham hex: #abc / #aabbcc — token kullanılmalı */
const hex = (cssCode.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => h !== "#000");
check("ham hex yok (tokenlar)", hex.length === 0, hex.join(" "));
check("görsel listesi yapılandırma dosyasında", /export const GALLERY/.test(cfgSrc) && !/\/assets\/hero\//.test(wallSrc));
check("next/image kullanılıyor", /from "next\/image"/.test(wallSrc));
check("lazy yükleme (körlemesine eager yok)", /loading="lazy"/.test(wallSrc) && !/priority/.test(wallSrc));

/* sabit metin sözlükte */
const M = Object.fromEntries(["tr", "en", "ru"].map((l) => [l, JSON.parse(readFileSync(path.join(root, `messages/${l}.json`), "utf8"))]));
check("başlık/metin üç dilde sözlükte", ["tr", "en", "ru"].every((l) => M[l].gallery?.metaTitle && M[l].gallery?.title?.length === 2));
check("meta açıklaması her dil için ayrı", new Set(["tr", "en", "ru"].map((l) => M[l].gallery.metaDesc)).size === 3);

const b = await chromium.launch();
const settle = async (p) => { await p.waitForTimeout(2000); };

/* ---- ROTA + DİL ---- */
const ROUTES = [["/galeri", "tr"], ["/en/gallery", "en"], ["/ru/galereya", "ru"]];
for (const [url, ln] of ROUTES) {
  const res = await fetch(base + url);
  check(`${url} 200 döndü`, res.status === 200, String(res.status));
  const html = await res.text();
  check(`${url}: <html lang="${ln}">`, new RegExp(`<html[^>]*lang="${ln}"`).test(html));
  check(`${url}: noindex YOK`, !/noindex/i.test(html));
  /* ana sayfa sahnesi bu rotada olmamalı */
  check(`${url}: sahne/scroller render EDİLMEMİŞ`, !/class="[^"]*\bstage\b/.test(html) && !/data-scroller/.test(html));
  check(`${url}: preloader yok`, !/class="pre[\s"]/.test(html));
}
/* hreflang üçlü */
const gh = await (await fetch(base + "/galeri")).text();
for (const l of ["tr", "en", "ru", "x-default"]) check(`hreflang ${l} var`, new RegExp(`hrefLang="${l}"`, "i").test(gh));
check("hreflang en → /en/gallery", /hrefLang="en"\s+href="[^"]*\/en\/gallery"/i.test(gh));
check("hreflang ru → /ru/galereya", /hrefLang="ru"\s+href="[^"]*\/ru\/galereya"/i.test(gh));
/* sitemap */
const sm = await (await fetch(base + "/sitemap.xml")).text();
check("sitemap'te üç dil de var", sm.includes("/galeri") && sm.includes("/en/gallery") && sm.includes("/ru/galereya"));

/* dil değiştirince karşılığına gider */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await settle(p);
  for (const [lab, want] of [["EN", "/en/gallery"], ["RU", "/ru/galereya"]]) {
    const href = await p.$eval(`.lang a:text-is("${lab}")`, (a) => a.getAttribute("href")).catch(() => null);
    check(`galeride ${lab} → ${want}`, href === want, String(href));
  }
  await p.close();
}

/* üst barda GALERİ bağlantısı */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(500);
  const nav = await p.evaluate(() => {
    const a = document.querySelector(".gnav");
    return a ? { t: a.textContent.trim(), href: a.getAttribute("href"), vis: a.getBoundingClientRect().width > 0 } : null;
  });
  check("ana sayfa üst barında GALERİ bağlantısı", !!nav && nav.vis && nav.href === "/galeri", JSON.stringify(nav));
  await p.close();
}

/* ---- DUVAR: her genişlikte sürüklenir, sarmalama kesintisiz ---- */
for (const [w, h] of [[360, 640], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errs.push(m.text().slice(0, 90)); });
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await settle(p);

  /* bir KOPYA ekranı kaplamalı, yoksa sarmalamada boşluk çıkar */
  const cover = await p.evaluate(() => {
    const wall = document.querySelector(".gwall");
    return { uw: wall.offsetWidth / 2, uh: wall.offsetHeight / 2, vw: innerWidth, vh: innerHeight };
  });
  check(`${w}px: bir kopya ekranı kaplıyor`, cover.uw >= cover.vw && cover.uh >= cover.vh, `birim ${Math.round(cover.uw)}×${Math.round(cover.uh)} / ekran ${cover.vw}×${cover.vh}`);

  /* uzun uzun sürükle: hiçbir yönde boşluk görünmemeli */
  const drag = await p.evaluate(async () => {
    const view = document.querySelector(".gwall-view");
    const wall = document.querySelector(".gwall");
    const R = view.getBoundingClientRect();
    const bad = [];
    const check1 = (tag) => {
      const b = wall.getBoundingClientRect();
      if (b.left > 0.5 || b.top > 0.5 || b.right < innerWidth - 0.5 || b.bottom < innerHeight - 0.5) bad.push(tag);
    };
    const g = async (dx, dy) => {
      const cx = R.left + R.width / 2, cy = R.top + R.height / 2;
      view.dispatchEvent(new PointerEvent("pointerdown", { clientX: cx, clientY: cy, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
      for (let i = 1; i <= 8; i++) {
        view.dispatchEvent(new PointerEvent("pointermove", { clientX: cx + dx * i / 8, clientY: cy + dy * i / 8, bubbles: true, pointerId: 1, isPrimary: true }));
        await new Promise((r) => requestAnimationFrame(r));
      }
      view.dispatchEvent(new PointerEvent("pointerup", { clientX: cx + dx, clientY: cy + dy, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 200));
    };
    const t0 = getComputedStyle(wall).transform;
    check1("başlangıç");
    for (let k = 0; k < 5; k++) { await g(320, 0); check1(`sağa${k}`); }
    for (let k = 0; k < 5; k++) { await g(-320, 0); check1(`sola${k}`); }
    for (let k = 0; k < 5; k++) { await g(0, 300); check1(`aşağı${k}`); }
    for (let k = 0; k < 5; k++) { await g(0, -300); check1(`yukarı${k}`); }
    for (let k = 0; k < 3; k++) { await g(260, 240); check1(`çapraz${k}`); }
    return { bad: bad.slice(0, 3), moved: getComputedStyle(wall).transform !== t0 };
  });
  check(`${w}px: duvar sürükleniyor`, drag.moved);
  check(`${w}px: sarmalama kesintisiz (boşluk yok)`, drag.bad.length === 0, drag.bad.join(" "));

  /* yatay taşma yok — sayfa tam ekran, scroll yok */
  const of = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, vw: innerWidth,
    sh: document.documentElement.scrollHeight, vh: innerHeight,
  }));
  check(`${w}px: yatay taşma yok`, of.sw <= of.vw, `${of.sw}/${of.vw}`);
  check(`${w}px: dikey sayfa scroll'u yok`, of.sh <= of.vh + 1, `${of.sh}/${of.vh}`);

  /* kareler hizalı, yarım satır yok: tüm karolar aynı boyutta ve kare */
  const tiles = await p.evaluate(() => {
    const t = [...document.querySelectorAll(".gtile")].slice(0, 40).map((e) => {
      const b = e.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    });
    return { sizes: [...new Set(t.map((x) => `${x.w}×${x.h}`))], kare: t.every((x) => Math.abs(x.w - x.h) <= 1) };
  });
  check(`${w}px: karolar eşit boyutta`, tiles.sizes.length === 1, tiles.sizes.join(" "));
  check(`${w}px: karolar KARE (1:1)`, tiles.kare, tiles.sizes[0]);

  check(`${w}px: konsol temiz (hidrasyon dahil)`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await p.close();
}

/* ---- wheel dinleyicisi (çalışma zamanı) ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => {
    window.__wheel = [];
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (t, ...r) {
      if (t === "wheel" || t === "mousewheel") window.__wheel.push(this === window ? "window" : this === document ? "document" : "el");
      return orig.call(this, t, ...r);
    };
  });
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await settle(p);
  const wheel = await p.evaluate(() => window.__wheel);
  check("window'da wheel dinleyicisi YOK", !wheel.includes("window"), wheel.join(",") || "hiç yok");
  await p.close();
}

/* ---- KLAVYE ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await settle(p);
  const tf = () => p.evaluate(() => getComputedStyle(document.querySelector(".gwall")).transform);
  await p.evaluate(() => document.querySelector(".gwall-view").focus());
  check("duvar odaklanabilir", await p.evaluate(() => document.activeElement === document.querySelector(".gwall-view")));
  for (const k of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
    const a = await tf();
    await p.keyboard.press(k);
    await p.waitForTimeout(520);
    check(`klavye ${k} kaydırdı`, (await tf()) !== a);
  }
  const outline = await p.evaluate(() => {
    const v = document.querySelector(".gwall-view");
    const cs = getComputedStyle(v);
    return { w: cs.outlineWidth, c: cs.outlineColor };
  });
  check("odak görünür (outline)", parseFloat(outline.w) >= 2, `${outline.w} ${outline.c}`);
  await p.close();
}

/* ---- reduced-motion ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await settle(p);
  const r = await p.evaluate(() => {
    const tile = document.querySelector(".gtile");
    return { anim: getComputedStyle(tile).animationName, op: getComputedStyle(tile).opacity };
  });
  check("reduced-motion: giriş animasyonu yok", r.anim === "none", r.anim);
  check("reduced-motion: karolar görünür", parseFloat(r.op) === 1, r.op);
  /* duvar hâlâ sürüklenebilir + klavye */
  const moved = await p.evaluate(async () => {
    const wall = document.querySelector(".gwall");
    const a = getComputedStyle(wall).transform;
    document.querySelector(".gwall-view").focus();
    document.querySelector(".gwall-view").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    return getComputedStyle(wall).transform !== a;
  });
  check("reduced-motion: duvar yine kullanılabilir (klavye)", moved);
  await ctx.close();
}

/* ---- GERÇEK DOKUNMA JESTİ ----
   touch-action korumasını CSS'e güvenerek değil, gerçek dokunmayla ölçüyoruz (istenen).
   Sentetik TouchEvent YETMİYOR: Draggable pointer olaylarını dinliyor, elle üretilen
   TouchEvent pointer üretmiyor ve "sürüklenmedi" gibi yanlış sonuç veriyordu.
   Bu yüzden CDP ile GERÇEK dokunma dizisi gönderiliyor. */
{
  const ctx = await b.newContext({ ...devices["iPhone 13"], hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await settle(p);
  const tf = () => p.evaluate(() => getComputedStyle(document.querySelector(".gwall")).transform);
  const before = await tf();
  const cdp = await ctx.newCDPSession(p);
  const pt = (x, y) => [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(200, 420) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(200 - i * 18, 420 - i * 15) });
    await p.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(800);
  check("gerçek dokunma jestiyle sürükleniyor", (await tf()) !== before);
  check("dokunurken sayfa KAYMIYOR", (await p.evaluate(() => window.scrollY)) === 0);
  await ctx.close();
}

/* ---- TRANSFER ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  let bytes = 0;
  p.on("response", async (res) => { try { bytes += (await res.body()).length; } catch {} });
  await p.goto(base + "/galeri", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  const imgs = await p.evaluate(() => document.querySelectorAll(".gtile img").length);
  check("ilk yükleme transferi < 1,5 MB", bytes < 1.5 * 1048576, `${(bytes / 1048576).toFixed(2)} MB · ${imgs} img öğesi`);
  await ctx.close();
}

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nTÜMÜ GEÇTİ");
process.exit(fail ? 1 : 0);
