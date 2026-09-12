/**
 * Tipografi + renk sistemi regresyonu.
 *  - statik: bileşen CSS/TSX'inde hex/rgba yok (tek kaynak app/globals.css :root), lib/palette.ts aynası eşit,
 *    next/font ve --font-mono kalıntısı yok, menüde bg/accent yok
 *  - çalışma zamanı: fontlar yerelden (harici istek 0), iki kritik font preload, Comico başlık/buton/fiyat,
 *    Bonny gövde; zemin gradyan; aydınlık bölümde limon perde; WCAG AA kontrast
 * Çalıştırma: node tests/e2e/palette.mjs  (sunucu: PANEL_KEY=test1234 … -p 3112)
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { mapP } from "./_segments.mjs";

const base = process.env.BASE ?? "http://localhost:3112";
const root = process.env.ROOT ?? path.resolve(import.meta.dirname, "../..");
let pass = 0,
  fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

/* ---------- statik ---------- */
function walk(dir, exts) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}
const files = [...walk(path.join(root, "components"), [".css", ".tsx", ".ts"]), ...walk(path.join(root, "app"), [".css", ".tsx", ".ts"])].filter(
  /* Hero.tsx: referans armatür SVG'si (docs/ref/hero) birebir kopya — gradyan durakları varlığın kendisi */
  (f) => !f.endsWith("app/globals.css") && !f.endsWith("app/api/og/route.tsx") && !f.endsWith("components/stage/Hero.tsx"),
);
const hard = [];
for (const f of files) {
  readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/mask-image/.test(line)) return; // alfa maskesi, renk değil
      if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|rgba?\(\s*\d/.test(line) && !/^\s*(\/\/|\/?\*)/.test(line.trim())) hard.push(`${path.relative(root, f)}:${i + 1}`);
    });
}
check("bileşenlerde hard-code renk yok (hex/rgba)", hard.length === 0, hard.slice(0, 6).join(" "));

const globals = readFileSync(path.join(root, "app/globals.css"), "utf8");
/* ölü token taraması için erken birleşim (allSrc aşağıda ayrıca kuruluyor) */
const allSrcEarly = files.map((f) => readFileSync(f, "utf8")).join("\n");
const cssVar = (n) => globals.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
const pal = readFileSync(path.join(root, "lib/palette.ts"), "utf8");
const tsVal = (k) => pal.match(new RegExp(`${k}:\\s*"(#[0-9a-fA-F]{6})"`))?.[1]?.toLowerCase();
/* 12 Eyl 2026: mor/limon palet KALDIRILDI → kırmızı/sarı/gri */
for (const [css, ts] of [
  ["mag-red", "red"],
  ["mag-yellow", "yellow"],
  ["mag-grey", "grey"],
  ["mag-red-deep", "redDeep"],
  ["mag-ink", "ink"],
  ["mag-on-red", "onRed"],
  ["mag-on-yellow", "onYellow"],
]) check(`palette.ts aynası = :root (${css})`, cssVar(css) && cssVar(css) === tsVal(ts), `${cssVar(css)} / ${tsVal(ts)}`);
check(":root --mag-red #c72d1b", cssVar("mag-red") === "#c72d1b");
check(":root --mag-yellow #fdd20e", cssVar("mag-yellow") === "#fdd20e");
check(":root --mag-grey #e7e2da", cssVar("mag-grey") === "#e7e2da");
check(":root --mag-red-deep #7a1b10", cssVar("mag-red-deep") === "#7a1b10");
check(":root --mag-ink #2a0906", cssVar("mag-ink") === "#2a0906");
/* Eski palet tamamen gitmeli: ölü token/ad kalmasın */
/* Yorumlar hariç: globals.css'te "--hero-white kaldırıldı" AÇIKLAMASI var, kural değil. */
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check("mor/limon token kalmadı (ölü token yok)", !/--mag-purple|--mag-lime|--hero-white/.test(stripComments(globals + allSrcEarly)), "");

const allSrc = files.map((f) => readFileSync(f, "utf8")).join("\n") + readFileSync(path.join(root, "lib/menu.ts"), "utf8");
/* Artık next/font KULLANILIYOR (tek aile MuseoModerno). Kritik olan çalışma zamanında
   harici istek olmaması; onu aşağıdaki "harici istek yok" kontrolü ölçüyor. */
check("next/font ile tek aile yükleniyor", /next\/font\/google/.test(readFileSync(path.join(root, "lib/fonts.ts"), "utf8")));
check("Google Fonts bağlantısı yok", !/fonts\.googleapis|fonts\.gstatic/.test(allSrc + globals));
check("--font-mono kalıntısı yok", !/--font-mono|font-mono\b/.test(allSrc + globals));
/* TEK AİLE: Tailwind'de font-display/font-body diye İKİ AYRI aile TANIMLANMAZ. */
check("Tailwind'de tek aile (font-sans), iki aile yok", /--font-sans: var\(--font-museo-stack\)/.test(globals) && !/--font-display:/.test(globals) && !/--font-body:/.test(globals));
const menu = readFileSync(path.join(root, "lib/menu.ts"), "utf8");
check("lib/menu.ts: ürün başına bg/accent yok", !/\bbg\??:|accent\??:/.test(menu));
/* Comico ve Bonny KALDIRILDI: @font-face bloğu, woff2 dosyaları ve preload bağlantıları
   tamamen gitti. Yüzler artık next/font ile derleme sırasında geliyor. */
const fontsTs = readFileSync(path.join(root, "lib/fonts.ts"), "utf8");
/* lib/fonts.ts hariç: orada "Comico ve Bonny kaldırıldı" AÇIKLAMASI var, kod değil. */
check("Comico/Bonny kalıntısı yok", !/Comico|Bonny|SeymourOne|FiraSansCondensed/.test(globals + allSrc));
/* Yorumları çıkar: globals'ta "@font-face bloğu yok" AÇIKLAMASI var, kural değil. */
check("@font-face bloğu kalmadı", !/@font-face/.test(globals.replace(/\/\*[\s\S]*?\*\//g, "")));
check("public/fonts klasörü boş/yok", !existsSync(path.join(root, "public/fonts")) || readdirSync(path.join(root, "public/fonts")).length === 0);
check("MuseoModerno + Kiril yedeği Comfortaa tanımlı", /MuseoModerno\(/.test(fontsTs) && /Comfortaa\(/.test(fontsTs));
check("latin-ext alt kümesi var (Türkçe için şart)", /"latin-ext"/.test(fontsTs));
check("display: swap", /display: "swap"/.test(fontsTs));

/* ---------- WCAG kontrast ---------- */
const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const blend = (fg, bg, a) => {
  const c = (h, i) => parseInt(h.slice(1 + i, 3 + i), 16);
  return "#" + [0, 2, 4].map((i) => Math.round(c(fg, i) * a + c(bg, i) * (1 - a)).toString(16).padStart(2, "0")).join("");
};
const YELLOW = cssVar("mag-yellow"), RED = cssVar("mag-red"), GREY = cssVar("mag-grey"), DEEP = cssVar("mag-red-deep"), INK = cssVar("mag-ink");
/* Gövde metninin gerçekte oturduğu yüzey: --mag-red-surface = %65 red + %35 deep
   (globals.css'te color-mix ile; burada aynı karışım elle kuruluyor). */
const SURFACE = blend(RED, DEEP, 0.65);
const pairs = [
  /* İSTENEN ÜÇ ÖLÇÜM */
  ["sarı yazı / kırmızı zemin (#C72D1B)", YELLOW, RED, 0],
  ["ink yazı / sarı zemin (buton dolgusu)", INK, YELLOW, 4.5],
  ["gri yazı / kırmızı zemin (#C72D1B)", GREY, RED, 0],
  /* Sitede gerçekten kullanılan yüzeyler */
  ["sarı yazı / gövde yüzeyi (%65 red + %35 deep)", YELLOW, SURFACE, 4.5],
  ["gri yazı / gövde yüzeyi", GREY, SURFACE, 4.5],
  ["sarı yazı / red-deep zemin", YELLOW, DEEP, 4.5],
  ["gri yazı / red-deep zemin", GREY, DEEP, 4.5],
  ["sarı yazı / ink zemin (hero)", YELLOW, INK, 4.5],
  ["gri yazı / ink zemin (hero)", GREY, INK, 4.5],
  ["ikincil (gri %65) / red-deep — bilgi", blend(GREY, DEEP, 0.65), DEEP, 0],
  ["ikincil (gri %65) / ink — bilgi", blend(GREY, INK, 0.65), INK, 0],
];
console.log("\n-- WCAG kontrast --");
for (const [name, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  console.log(`   ${name}: ${r.toFixed(2)}:1  ${r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA (yalnızca büyük metin)" : "YETERSİZ"}`);
  if (min) check(`kontrast AA (${name})`, r >= min, r.toFixed(2) + ":1");
}

/* ---------- çalışma zamanı ---------- */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const ext = [];
ctx.on("request", (q) => {
  if (!q.url().startsWith(base) && !q.url().startsWith("data:")) ext.push(q.url());
});
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await page.goto(base + "/", { waitUntil: "load" });
const pre = await page.$$eval('link[rel="preload"][as="font"]', (ls) => ls.map((l) => [l.getAttribute("href"), l.getAttribute("crossorigin") !== null]));
/* next/font kendi preload'unu yazar (yüz başına bir tane), hepsi crossorigin olmalı. */
check("next/font preload'ları crossorigin", pre.length > 0 && pre.every((p) => p[1]) && pre.every((p) => p[0].includes("/_next/static/media/")), `${pre.length} yüz`);
await page.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 });
await page.waitForTimeout(500);
const rt = await page.evaluate(async () => {
  await document.fonts.ready;
  const fam = (sel) => getComputedStyle(document.querySelector(sel)).fontFamily.split(",")[0].replace(/"/g, "");
  const cs = getComputedStyle(document.documentElement);
  return {
    loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}/${f.weight}`),
    h1: fam("h1"), body: fam("body"), cta: fam(".cta"), p: fam(".left p"), badge: fam(".badge b"), mark: fam(".mark"), hint: fam(".counter"),
    synth: getComputedStyle(document.documentElement).fontSynthesis,
    accent: cs.getPropertyValue("--accent").trim(), yellow: cs.getPropertyValue("--mag-yellow").trim(),
    stageBg: getComputedStyle(document.querySelector(".stage")).backgroundImage,
    bodyBg: getComputedStyle(document.body).backgroundImage,
    /* h1 artık hero ismi (referans: beyaz); palet kontrolü iddia başlığında */
    h1Color: getComputedStyle(document.querySelector(".left .big")).color,
    ctaBg: getComputedStyle(document.querySelector(".cta")).backgroundColor,
    ctaColor: getComputedStyle(document.querySelector(".cta")).color,
    /* ışık konisi WebGL ile çizilir: renk shader içinde, burada varlığı + blend modu denetlenir */
    rays: (() => { const r = document.querySelector(".rays"); return r ? { blend: getComputedStyle(r).mixBlendMode, canvas: !!r.querySelector("canvas") } : null; })(),
  };
});
check("harici istek yok (font dahil)", ext.length === 0, ext.slice(0, 3).join(" "));
check("MuseoModerno + Comfortaa yüklendi", rt.loaded.some((f) => f.startsWith("MuseoModerno")) && rt.loaded.some((f) => f.startsWith("Comfortaa")), rt.loaded.join(" "));
check("h1 / .cta / .mark / .badge b → MuseoModerno", [rt.h1, rt.cta, rt.mark, rt.badge].every((f) => f === "MuseoModerno"), JSON.stringify([rt.h1, rt.cta, rt.mark, rt.badge]));
/* TEK AİLE: gövde de başlık da MuseoModerno; ayrım kalınlıkta (aşağıda ölçülüyor). */
check("body / .left p / .counter → MuseoModerno", [rt.body, rt.p, rt.hint].every((f) => f === "MuseoModerno"), JSON.stringify([rt.body, rt.p, rt.hint]));
check("font-synthesis: none (sahte kalın/italik yok)", rt.synth === "none", rt.synth);
check("--accent = sarı", rt.accent.toLowerCase() === rt.yellow.toLowerCase(), rt.accent);
/* HERO zemini: ürün fotoğrafları bozulmasın diye düz kırmızı DEĞİL, ink → red-deep. */
check("hero zemini: ink → red-deep dikey gradyan", /linear-gradient/.test(rt.stageBg) && /rgb\(42, 9, 6\)/.test(rt.stageBg) && /rgb\(122, 27, 16\)/.test(rt.stageBg), rt.stageBg.slice(0, 80));
check("sayfa gövdesi de aynı gradyan", /linear-gradient/.test(rt.bodyBg));
check("iddia başlığı (.left .big) rengi sarı", rt.h1Color === "rgb(253, 210, 14)", rt.h1Color);
check("buton: sarı dolgu + ink yazı", rt.ctaBg === "rgb(253, 210, 14)" && rt.ctaColor === "rgb(42, 9, 6)", `${rt.ctaBg} / ${rt.ctaColor}`);
check("hero ışık konisi: WebGL katmanı (screen blend)", rt.rays?.canvas === true && rt.rays?.blend === "screen", JSON.stringify(rt.rays));

/* aydınlık bölüm (manifesto): limon perde tam, chrome yazısı ink */
const pd = 0.68;
await page.evaluate((v) => {
  const m = document.documentElement.scrollHeight - innerHeight;
  window.scrollTo(0, Math.round(v * m));
}, mapP(pd, false));
await page.waitForFunction(() => document.documentElement.classList.contains("lm"), null, { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(600);
const lm = await page.evaluate(() => ({
  lm: document.documentElement.classList.contains("lm"),
  bright: parseFloat(getComputedStyle(document.querySelector(".bgBright")).opacity),
  brightBg: getComputedStyle(document.querySelector(".bgBright")).backgroundColor,
  /* .menu kalktı: üst çubuk artık SİPARİŞ + İLETİŞİM çifti. Aydınlık bölümde
     SİPARİŞ koyu dolgu/krem yazı, İLETİŞİM çerçeveli ink yazı olur. */
  orderBg: getComputedStyle(document.querySelector("[data-order-cta]")).backgroundColor,
  orderColor: getComputedStyle(document.querySelector("[data-order-cta]")).color,
  contactColor: getComputedStyle(document.querySelector("[data-contact-open]")).color,
}));
check("manifesto: html.lm + sarı perde ≥ .95", lm.lm && lm.bright >= 0.95 && lm.brightBg === "rgb(253, 210, 14)", JSON.stringify(lm));
check("manifesto: SİPARİŞ ters dolgu (ink zemin, sarı yazı)", lm.orderBg === "rgb(42, 9, 6)" && lm.orderColor === "rgb(253, 210, 14)", `${lm.orderBg} / ${lm.orderColor}`);
check("manifesto: İLETİŞİM yazısı ink", lm.contactColor === "rgb(42, 9, 6)", lm.contactColor);

/* sipariş sayfası: fiyat Comico, açıklama Bonny */
await page.goto(base + "/siparis", { waitUntil: "load" });
await page.waitForSelector(".pcard", { timeout: 10000 });
const ord = await page.evaluate(() => {
  const fam = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "") : "-");
  return { price: fam(document.querySelector(".prow .price")), tname: fam(document.querySelector(".pbody .tname")), desc: fam(document.querySelector(".pdesc")), add: fam(document.querySelector(".addbtn")), chip: fam(document.querySelector(".catchip")) };
});
check("/siparis: fiyat + ürün adı + SEPETE EKLE → MuseoModerno", ord.price === "MuseoModerno" && ord.tname === "MuseoModerno" && ord.add === "MuseoModerno", JSON.stringify(ord));
check("/siparis: açıklama + kategori çipi → MuseoModerno", ord.desc === "MuseoModerno" && ord.chip === "MuseoModerno", JSON.stringify(ord));

/* panel: yazılar Bonny, marka Comico, harici istek yok */
await page.goto(base + "/panel", { waitUntil: "load" });
await page.waitForSelector("form input[type=password]", { timeout: 8000 });
const pnl = await page.evaluate(() => {
  const fam = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "") : "-");
  return { input: fam(document.querySelector("input[type=password]")), mark: fam(document.querySelector(".pnl-mark")), pre: document.querySelectorAll('link[rel="preload"][as="font"]').length };
});
check("/panel: tek aile + next/font preload", pnl.input === "MuseoModerno" && pnl.mark === "MuseoModerno" && pnl.pre > 0, JSON.stringify(pnl));
check("harici istek yok (tüm sayfalar)", ext.length === 0, ext.slice(0, 3).join(" "));

await browser.close();
console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
