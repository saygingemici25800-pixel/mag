/**
 * Tipografi + renk sistemi regresyonu.
 *  - statik: bileşen CSS/TSX'inde hex/rgba yok (tek kaynak app/globals.css :root), lib/palette.ts aynası eşit,
 *    next/font ve --font-mono kalıntısı yok, menüde bg/accent yok
 *  - çalışma zamanı: fontlar yerelden (harici istek 0), iki kritik font preload, Comico başlık/buton/fiyat,
 *    Bonny gövde; zemin gradyan; aydınlık bölümde limon perde; WCAG AA kontrast
 * Çalıştırma: node tests/e2e/palette.mjs  (sunucu: PANEL_KEY=test1234 … -p 3112)
 */
import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync } from "node:fs";
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
  (f) => !f.endsWith("app/globals.css") && !f.endsWith("app/api/og/route.tsx"),
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
const cssVar = (n) => globals.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
const pal = readFileSync(path.join(root, "lib/palette.ts"), "utf8");
const tsVal = (k) => pal.match(new RegExp(`${k}:\\s*"(#[0-9a-fA-F]{6})"`))?.[1]?.toLowerCase();
for (const [css, ts] of [
  ["mag-purple", "purple"],
  ["mag-lime", "lime"],
  ["mag-purple-deep", "purpleDeep"],
  ["mag-purple-soft", "purpleSoft"],
  ["mag-ink", "ink"],
]) check(`palette.ts aynası = :root (${css})`, cssVar(css) && cssVar(css) === tsVal(ts), `${cssVar(css)} / ${tsVal(ts)}`);
check(":root --mag-purple #422057", cssVar("mag-purple") === "#422057");
check(":root --mag-lime #ffd662", cssVar("mag-lime") === "#ffd662");

const allSrc = files.map((f) => readFileSync(f, "utf8")).join("\n") + readFileSync(path.join(root, "lib/menu.ts"), "utf8");
check("next/font kullanılmıyor", !/next\/font/.test(allSrc));
check("Google Fonts bağlantısı yok", !/fonts\.googleapis|fonts\.gstatic/.test(allSrc + globals));
check("--font-mono kalıntısı yok", !/--font-mono|font-mono\b/.test(allSrc + globals));
check("Tailwind'de font-display / font-body tanımlı", /--font-display: var\(--font-display\)/.test(globals) && /--font-body: var\(--font-body\)/.test(globals));
const menu = readFileSync(path.join(root, "lib/menu.ts"), "utf8");
check("lib/menu.ts: ürün başına bg/accent yok", !/\bbg\??:|accent\??:/.test(menu));
check("@font-face: Comico 400 + Bonny 100/300/400/500/700, hepsi swap", ["ComicoRegular", "BonnyThin", "BonnyLight", "BonnyRegular", "BonnyMedium", "BonnyBold"].every((n) => globals.includes(`/fonts/${n}.woff2`)) && (globals.match(/font-display: swap/g) ?? []).length === 6);

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
const LIME = cssVar("mag-lime"), PURPLE = cssVar("mag-purple"), DEEP = cssVar("mag-purple-deep"), INK = cssVar("mag-ink");
const pairs = [
  ["ink üzerinde… limon (buton: ink yazı, limon dolgu)", INK, LIME, 4.5],
  ["limon yazı / mor zemin (#422057)", LIME, PURPLE, 4.5],
  ["limon yazı / mor-derin zemin (#1A0C22)", LIME, DEEP, 4.5],
  ["ikincil (limon %60) / mor zemin — bilgi (spec %60; AA için ≥%66 gerekir)", blend(LIME, PURPLE, 0.6), PURPLE, 0],
  ["ikincil (limon %60) / mor-derin zemin — bilgi", blend(LIME, DEEP, 0.6), DEEP, 0],
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
check("2 kritik font preload (Comico + Bonny Regular, crossorigin)", pre.length === 2 && pre.every((p) => p[1]) && pre.some((p) => p[0].includes("Comico")) && pre.some((p) => p[0].includes("BonnyRegular")), JSON.stringify(pre));
await page.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 });
await page.waitForTimeout(500);
const rt = await page.evaluate(async () => {
  await document.fonts.ready;
  const fam = (sel) => getComputedStyle(document.querySelector(sel)).fontFamily.split(",")[0].replace(/"/g, "");
  const cs = getComputedStyle(document.documentElement);
  return {
    loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}/${f.weight}`),
    h1: fam("h1"), body: fam("body"), cta: fam(".cta"), p: fam(".left p"), badge: fam(".badge b"), mark: fam(".mark"), hint: fam(".hint"),
    synth: getComputedStyle(document.documentElement).fontSynthesis,
    accent: cs.getPropertyValue("--accent").trim(), lime: cs.getPropertyValue("--mag-lime").trim(),
    stageBg: getComputedStyle(document.querySelector(".stage")).backgroundImage,
    bodyBg: getComputedStyle(document.body).backgroundImage,
    h1Color: getComputedStyle(document.querySelector("h1")).color,
    ctaBg: getComputedStyle(document.querySelector(".cta")).backgroundColor,
    ctaColor: getComputedStyle(document.querySelector(".cta")).color,
    aura: getComputedStyle(document.querySelector(".aura")).backgroundImage,
  };
});
check("harici istek yok (font dahil)", ext.length === 0, ext.slice(0, 3).join(" "));
check("Comico + Bonny yüklendi", rt.loaded.some((f) => f.startsWith("Comico")) && rt.loaded.some((f) => f.startsWith("Bonny")), rt.loaded.join(" "));
check("h1 / .cta / .mark / .badge b → Comico", [rt.h1, rt.cta, rt.mark, rt.badge].every((f) => f === "Comico"), JSON.stringify([rt.h1, rt.cta, rt.mark, rt.badge]));
check("body / .left p / .hint → Bonny", [rt.body, rt.p, rt.hint].every((f) => f === "Bonny"), JSON.stringify([rt.body, rt.p, rt.hint]));
check("font-synthesis: none (sahte kalın/italik yok)", rt.synth === "none", rt.synth);
check("--accent = limon", rt.accent.toLowerCase() === rt.lime.toLowerCase(), rt.accent);
check("sahne zemini: mor-derin → mor dikey gradyan", /linear-gradient/.test(rt.stageBg) && /rgb\(26, 12, 34\)/.test(rt.stageBg) && /rgb\(66, 32, 87\)/.test(rt.stageBg), rt.stageBg.slice(0, 80));
check("sayfa gövdesi de aynı gradyan", /linear-gradient/.test(rt.bodyBg));
check("h1 rengi limon", rt.h1Color === "rgb(255, 214, 98)", rt.h1Color);
check("buton: limon dolgu + ink yazı", rt.ctaBg === "rgb(255, 214, 98)" && rt.ctaColor === "rgb(26, 12, 34)", `${rt.ctaBg} / ${rt.ctaColor}`);
check("sıcak ada: aura amber karışımı (mor değil, saf turuncu değil)", /radial-gradient/.test(rt.aura) && !/255, 150, 54/.test(rt.aura), rt.aura.slice(0, 70));

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
  menuColor: getComputedStyle(document.querySelector(".menu")).color,
}));
check("manifesto: html.lm + limon perde ≥ .95", lm.lm && lm.bright >= 0.95 && lm.brightBg === "rgb(255, 214, 98)", JSON.stringify(lm));
check("manifesto: chrome yazısı ink", lm.menuColor === "rgb(26, 12, 34)", lm.menuColor);

/* sipariş sayfası: fiyat Comico, açıklama Bonny */
await page.goto(base + "/siparis", { waitUntil: "load" });
await page.waitForSelector(".pcard", { timeout: 10000 });
const ord = await page.evaluate(() => {
  const fam = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "") : "-");
  return { price: fam(document.querySelector(".prow .price")), tname: fam(document.querySelector(".pbody .tname")), desc: fam(document.querySelector(".pdesc")), add: fam(document.querySelector(".addbtn")), chip: fam(document.querySelector(".catchip")) };
});
check("/siparis: fiyat + ürün adı + SEPETE EKLE → Comico", ord.price === "Comico" && ord.tname === "Comico" && ord.add === "Comico", JSON.stringify(ord));
check("/siparis: açıklama + kategori çipi → Bonny", ord.desc === "Bonny" && ord.chip === "Bonny", JSON.stringify(ord));

/* panel: yazılar Bonny, marka Comico, harici istek yok */
await page.goto(base + "/panel", { waitUntil: "load" });
await page.waitForSelector("form input[type=password]", { timeout: 8000 });
const pnl = await page.evaluate(() => {
  const fam = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "") : "-");
  return { input: fam(document.querySelector("input[type=password]")), mark: fam(document.querySelector(".pnl-mark")), pre: document.querySelectorAll('link[rel="preload"][as="font"]').length };
});
check("/panel: girdi Bonny, marka Comico, 2 preload", pnl.input === "Bonny" && pnl.mark === "Comico" && pnl.pre === 2, JSON.stringify(pnl));
check("harici istek yok (tüm sayfalar)", ext.length === 0, ext.slice(0, 3).join(" "));

await browser.close();
console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
