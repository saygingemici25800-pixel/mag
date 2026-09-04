// İddia bölümü "patlamış burger" — iki kesin kural + ışık:
//  (1) ekranda asla iki burger yok: aynı karede fotoğraf ve yığın birlikte görünmez; takas display ile
//  (2) tek düzlem: katmanlar yalnızca translateY, perspektif/translateZ/döndürme/ölçek yok, viewport içinde
//  ışık: taban .35, yalnızca aktif katman(lar) 1; ışık elemanı aktif katmanla kayar
//  takas hizası: kapalı yığın ile fotoğraf gövdesi aynı yükseklik ve aynı merkez
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MOBILE_TOTAL, mapP, segmentsFor } from "./_segments.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/explode";
const root = process.argv[4] ?? "/Users/saygin/Downloads/mag-starter";
mkdirSync(out, { recursive: true });
const M = JSON.parse(readFileSync(path.join(root, "lib/katmanMetrics.json"), "utf8"));
const CUT = JSON.parse(readFileSync(path.join(root, "lib/cutCenters.json"), "utf8"));

const CLAIMS = [
  { n: "et", p: 0.36, active: ["et"] },
  { n: "ekmek", p: 0.42, active: ["ekmekUst", "ekmekAlt"] },
  { n: "peynir", p: 0.5, active: ["peynir"] },
  { n: "sos", p: 0.555, active: ["sos"] },
];
const ALL = ["ekmekUst", "sos", "peynir", "et", "ekmekAlt"];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

/* Görünür kutular alfa ölçümlerinden (katmanMetrics / cutCenters.body) — <img> kutusundan değil */
const probe = (p) => p.evaluate(([M, CUT]) => {
  const vis = (el) => !!el && getComputedStyle(el).display !== "none" && parseFloat(getComputedStyle(el).opacity) > 0.02;
  const item = document.querySelector(".item.focus"); const img = item?.querySelector("img"); const ex = document.querySelector(".explode");
  let photo = null;
  if (vis(item) && img) { const r = img.getBoundingClientRect(); const bd = CUT[item.dataset.k]?.body ?? CUT[item.dataset.k]?.box;
    if (bd) photo = { x0: r.x + bd.x0 * r.width, x1: r.x + bd.x1 * r.width, y0: r.y + bd.y0 * r.height, y1: r.y + bd.y1 * r.height }; }
  let stack = null; const layers = {};
  if (vis(ex)) {
    let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9;
    for (const el of document.querySelectorAll(".exLayer")) {
      const im = el.querySelector("img"); const m = M[im.currentSrc.split("/").pop().replace(/(@2x)?\.webp$/, "")];
      const bb = im.getBoundingClientRect(); const side = Math.min(bb.width, bb.height);
      const ox = bb.x + (bb.width - side) / 2, oy = bb.y + (bb.height - side) / 2, k = el.dataset.layer;
      let y0 = oy + (m.cy - m.h / 2) * side, y1 = oy + (m.cy + m.h / 2) * side; const cut = oy + 0.48 * side;
      if (k === "ekmekUst") y1 = Math.min(y1, cut); if (k === "ekmekAlt") y0 = Math.max(y0, cut);
      X0 = Math.min(X0, ox + (m.cx - m.w / 2) * side); X1 = Math.max(X1, ox + (m.cx + m.w / 2) * side); Y0 = Math.min(Y0, y0); Y1 = Math.max(Y1, y1);
      layers[k] = { opacity: parseFloat(el.style.opacity), tf: el.style.transform, filter: getComputedStyle(el).filter, blend: getComputedStyle(el).mixBlendMode };
    }
    stack = { x0: X0, x1: X1, y0: Y0, y1: Y1 };
  }
  const light = document.querySelector(".exLight");
  return { photo, stack, layers, lightOp: light ? parseFloat(light.style.opacity || "0") : 0, lightTf: light?.style.transform ?? "",
    perspective: ex ? getComputedStyle(ex).perspective : "none", stackExists: !!ex, vw: innerWidth, vh: innerHeight };
}, [M, CUT]);

/* v: MASAÜSTÜ p; mobilde aynı bölümdeki karşılığına eşlenir (segment haritası mobilde farklı) */
let MOBILE = false;
const at = async (p, v, settle = 1400) => {
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(v, MOBILE));
  await p.waitForTimeout(settle);
  return probe(p);
};
const fresh = async (b, opts = {}) => {
  const p = await b.newPage({ viewport: { width: opts.w ?? 1440, height: opts.h ?? 860 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(700);
  return p;
};
const inside = (b, vw, vh) => b.x0 >= -1 && b.x1 <= vw + 1 && b.y0 >= -1 && b.y1 <= vh + 1;

const b = await chromium.launch();
for (const vp of [{ w: 1440, h: 860 }, { w: 390, h: 844 }]) {
  const tag = `${vp.w}x${vp.h}`;
  MOBILE = vp.w < 900;
  const p = await fresh(b, vp);
  /* segment aynası doğru mu: mobil scroller yüksekliği 1200vh × MOBILE_TOTAL olmalı */
  const scrollerVh = await p.evaluate(() => document.querySelector(".scroller").offsetHeight / innerHeight);
  check(`${tag} scroller yüksekliği harita ile tutarlı`, Math.abs(scrollerVh - (MOBILE ? 12 * MOBILE_TOTAL : 12)) < 0.06, `${scrollerVh.toFixed(2)}vh/100`);

  // ---- KURAL 1: bölüm boyunca 24 karede asla iki burger yok, hiç burger yok da yok
  let both = 0, none = 0, overflow = 0, multiLit = 0, plane = 0;
  for (let i = 0; i < 24; i++) {
    const r = await at(p, 0.26 + (0.4 * i) / 23, i === 0 ? 3000 : 1100);
    if (r.photo && r.stack) both++;
    if (!r.photo && !r.stack) none++;
    const box = r.stack ?? r.photo;
    if (box && !inside(box, r.vw, r.vh)) overflow++;
    const lit = ALL.filter((k) => r.layers[k]?.opacity === 1);
    if (r.stack && lit.length > 2) multiLit++;
    if (r.stack && !(ALL.every((k) => /^translateY\(-?\d+px\)$/.test(r.layers[k].tf)) && r.perspective === "none")) plane++;
    if (vp.w === 1440) await p.screenshot({ path: `${out}/f${String(i + 1).padStart(2, "0")}.png` });
  }
  check(`${tag} 24 karede fotoğraf+yığın aynı anda hiç görünmedi`, both === 0, `iki burger=${both}`);
  check(`${tag} 24 karede burgersiz kare yok`, none === 0, `boş=${none}`);
  check(`${tag} 24 karede taşma yok (görünür kutu viewport içinde)`, overflow === 0, `taşan=${overflow}`);
  check(`${tag} 24 karede en fazla 2 katman aydınlık`, multiLit === 0, `fazla=${multiLit}`);
  check(`${tag} tek düzlem (yalnızca translateY, perspektif yok)`, plane === 0, `ihlal=${plane}`);

  // ---- takas hizası: P_OUT=.60 (yığın kapalı) — aynı yükseklik, aynı merkez
  const A = await at(p, 0.5995, 3000), B = await at(p, 0.6005, 3000);
  check(`${tag} çıkış takası: önce yığın, sonra fotoğraf`, !!A.stack && !A.photo && !!B.photo && !B.stack);
  if (A.stack && B.photo) {
    const dh = (A.stack.y1 - A.stack.y0) - (B.photo.y1 - B.photo.y0);
    const dcx = (A.stack.x0 + A.stack.x1 - B.photo.x0 - B.photo.x1) / 2, dcy = (A.stack.y0 + A.stack.y1 - B.photo.y0 - B.photo.y1) / 2;
    check(`${tag} takas: yükseklik eşit`, Math.abs(dh) <= 2, `Δ=${dh.toFixed(1)}px`);
    check(`${tag} takas: merkez eşit`, Math.abs(dcx) <= 2 && Math.abs(dcy) <= 2, `Δx=${dcx.toFixed(1)} Δy=${dcy.toFixed(1)}`);
    console.log(`     (bilgi) ${tag} takas genişlik farkı ${((A.stack.x1 - A.stack.x0) - (B.photo.x1 - B.photo.x0)).toFixed(0)}px — fotoğraf/ekmek en-boy oranı farkı, varlık kaynaklı`);
  }
  const C = await at(p, 0.2995, 3000), D = await at(p, 0.3005, 3000);
  check(`${tag} giriş takası: önce fotoğraf, sonra yığın`, !!C.photo && !C.stack && !!D.stack && !D.photo);

  // ---- IŞIK: her iddiada yalnızca beklenen katman(lar) 1, diğerleri .35, ışık açık
  for (const c of CLAIMS) {
    const r = await at(p, c.p, 1600);
    if (!r.stack) { check(`${tag} ${c.n}: yığın görünür`, false); continue; }
    const lit = ALL.filter((k) => r.layers[k].opacity === 1);
    check(`${tag} ${c.n}: aydınlık = [${c.active}]`, lit.length === c.active.length && c.active.every((k) => lit.includes(k)), `aydınlık=[${lit}]`);
    check(`${tag} ${c.n}: diğerleri sönük (≤.15)`, ALL.filter((k) => !c.active.includes(k)).every((k) => r.layers[k].opacity <= 0.15), ALL.map((k) => r.layers[k].opacity).join(","));
    check(`${tag} ${c.n}: ışık açık (≤.5)`, r.lightOp > 0.3 && r.lightOp <= 0.5, `ışık=${r.lightOp}`);
    check(`${tag} ${c.n}: filter/blend yok`, ALL.every((k) => (r.layers[k].filter === "none") && r.layers[k].blend === "normal"));
    if (vp.w === 1440) await p.screenshot({ path: `${out}/1440-${c.n}.png` });
    else if (c.n === "ekmek") await p.screenshot({ path: `${out}/390-ekmek.png` });
  }
  /* iddia geçişi: ET → EKMEK. Geçiş boyunca 30 ms'de bir örnekle; hiçbir karede iki iddianın
     katmanları birden aydınlık (>.3) olmamalı — eski söner, sonra yenisi yanar. */
  await at(p, 0.36, 1500);
  const Sd = segmentsFor(false);
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(Sd.c1[0] + 0.004, MOBILE));
  const samples = await p.evaluate(async () => {
    const out = []; const t0 = performance.now();
    while (performance.now() - t0 < 1400) {
      const o = {}; for (const el of document.querySelectorAll(".exLayer")) o[el.dataset.layer] = parseFloat(getComputedStyle(el).opacity);
      out.push(o); await new Promise((r) => setTimeout(r, 30));
    }
    return out;
  });
  const SETS = [["et"], ["ekmekUst", "ekmekAlt"], ["peynir"], ["sos"]];
  const mixed = samples.filter((o) => { const litKeys = ALL.filter((k) => o[k] > 0.3); return litKeys.length && !SETS.some((S) => litKeys.every((k) => S.includes(k))); });
  check(`${tag} iddia geçişinde iki iddia aynı anda aydınlık olmadı`, mixed.length === 0, `${mixed.length}/${samples.length} karışık kare`);
  check(`${tag} geçiş sonunda yalnızca ekmek çifti aydınlık`, (() => { const o = samples[samples.length - 1]; return o.ekmekUst > 0.9 && o.ekmekAlt > 0.9 && o.et < 0.2; })(), JSON.stringify(samples[samples.length - 1]));
  await p.close();
}

// ---- hasLayers=false ürün: fotoğraf kalır, yığın hiç çizilmez
{
  const p = await fresh(b);
  await p.click('button[aria-label="Sonraki ürün"]'); await p.waitForTimeout(700);
  await p.click('button[aria-label="Sonraki ürün"]'); await p.waitForTimeout(900);
  const r = await at(p, 0.42);
  check("katmansız üründe fotoğraf kalır, yığın yok", !!r.photo && !r.stack, `foto=${!!r.photo} yığın=${!!r.stack}`);
  await p.screenshot({ path: `${out}/1440-katmansiz.png` });
  await p.close();
}
// ---- reduced-motion: hareketli sahne yok
{
  const p = await fresh(b, { reduced: true });
  check("reduced-motion: hareketli sahne çizilmez", !(await p.evaluate(() => Boolean(document.querySelector(".explode") || document.querySelector(".field")))));
  await p.screenshot({ path: `${out}/1440-reduced.png` });
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
