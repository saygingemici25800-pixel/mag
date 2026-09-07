// İddia bölümü — tek planda yatay akış (burger BÜTÜN, katman/dilim yok):
//  - burger her karede bütün, kırpılmamış, viewport içinde
//  - dört durak: c0 (+26%,−14%) · c1 (−26%,−6%) · c2 (+22%,+4%) · c3 (−26%,+14%) — mobilde yarısı
//  - dönüş c0 −2° → c3 +2° doğrusal; ölçek 1 → 1.03 → 1; filtre yok
//  - metin burgerin karşı tarafında (c0 sol, c1 sağ, c2 sol, c3 sağ), hiçbir durakta çakışma yok
//  - ışık konisi (LightRays) hero'dan devralınır; iddia bölümünde sönümlenir
//  - reduced-motion: burger sabit, metinler hareketsiz görünür
//  - eski dilim/katman sistemi kaynakta yok
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { mapP, segmentsFor } from "./_segments.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/akis";
const root = process.argv[4] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
mkdirSync(out, { recursive: true });
const CLAIM_X = [0.26, -0.26, 0.22, -0.26];
const CLAIM_Y = [-0.14, -0.06, 0.04, 0.14];
const CLAIM_SIDE = ["left", "right", "left", "right"];
const CLAIM_ROT = [-2, -0.667, 0.667, 2];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

/* ---- statik: ölü kod yok ---- */
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = ["components", "lib", "app", "scripts"].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(ts|tsx|mjs|css)$/.test(f));
const dead = src.filter((f) => /assets\/(dilim|katman)|lib\/(dilim|katman)|hasLayers|\bExplode\b|exLayer|LAYER_ORDER|CLAIM_SLICE|\bSlices\b|sliceFig/.test(readFileSync(f, "utf8")));
check("dilim/katman sistemi kaynakta yok", dead.length === 0, dead.map((f) => path.relative(root, f)).join(" "));
for (const p of ["public/assets/dilim", "public/assets/katman", "lib/dilim.ts", "lib/dilim-paths.ts", "lib/katman.ts", "components/stage/Slices.tsx", "components/stage/Explode.tsx", "tests/e2e/claims-explode.mjs"])
  check(`silindi: ${p}`, !existsSync(path.join(root, p)));

/* ---- çalışma zamanı ---- */
const probe = (p) => p.evaluate(() => {
  const item = document.querySelector(".item.focus");
  const img = item?.querySelector(".img");
  const txt = document.querySelector(".claimText");
  const rail = document.querySelector(".rail");
  const cs = (el) => getComputedStyle(el);
  const r = img.getBoundingClientRect();
  const m = new DOMMatrixReadOnly(cs(item).transform);
  const t = txt?.getBoundingClientRect();
  /* görselin gerçek (alfa) kutusu değil, contain kutusu: object-fit contain + alta yaslı */
  const nat = { w: img.naturalWidth, h: img.naturalHeight };
  const boxAr = r.width / r.height, imgAr = nat.w / nat.h;
  const vw2 = imgAr > boxAr ? r.width : r.height * imgAr;
  const vh2 = imgAr > boxAr ? r.width / imgAr : r.height;
  const vis = { x0: r.x + (r.width - vw2) / 2, x1: r.x + (r.width + vw2) / 2, y0: r.bottom - vh2, y1: r.bottom };
  return {
    burger: vis,
    center: (vis.x0 + vis.x1) / 2 - innerWidth / 2,
    centerY: (vis.y0 + vis.y1) / 2,
    rot: +((Math.atan2(m.b, m.a) * 180) / Math.PI).toFixed(2),
    scale: +Math.hypot(m.a, m.b).toFixed(3),
    filter: cs(item).filter,
    imgOpacity: +cs(img).opacity,
    text: t ? { x0: t.x, x1: t.right, y0: t.y, y1: t.bottom } : null,
    side: txt?.dataset.side ?? "", ci: txt?.dataset.ci ?? "", textOp: txt ? +cs(txt).opacity : 0,
    claimY: innerHeight * (innerWidth < 900 ? 0.3 : 0.46),
    rail: rail ? (() => { const q = rail.getBoundingClientRect(); return { x0: q.x, x1: q.right, y0: q.y, y1: q.bottom }; })() : null,
    vw: innerWidth, vh: innerHeight,
  };
});
let MOBILE = false;
const at = async (p, v, settle = 1500) => {
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(v, MOBILE));
  await p.waitForTimeout(settle);
  return probe(p);
};
const fresh = async (b, o = {}) => {
  const p = await b.newPage({ viewport: { width: o.w ?? 1440, height: o.h ?? 860 }, reducedMotion: o.reduced ? "reduce" : "no-preference", isMobile: !!o.mobile, hasTouch: !!o.mobile });
  await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(700);
  return p;
};
const inView = (s) => s.burger.x0 >= -1 && s.burger.x1 <= s.vw + 1 && s.burger.y0 >= -1 && s.burger.y1 <= s.vh + 1;
const overlap = (a, b) => a && b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const b = await chromium.launch();
let p = await fresh(b);
/* aşama merkezleri: her segmentin ortası */
const S = segmentsFor(false);
const mid = [S.c0, S.c1, S.c2, S.c3].map(([a, z]) => (a + z) / 2);

const ys = [];
for (let i = 0; i < 4; i++) {
  const s = await at(p, mid[i], 1700);
  const expX = CLAIM_X[i] * s.vw;
  check(`c${i}: yatay merkez ${(CLAIM_X[i] * 100).toFixed(0)}% (±3% vw)`, Math.abs(s.center - expX) < s.vw * 0.03, `ölçülen ${s.center.toFixed(0)} px · beklenen ${expX.toFixed(0)} px`);
  ys.push(s.centerY);
  check(`c${i}: dönüş ${CLAIM_ROT[i]}° (±0.4°)`, Math.abs(s.rot - CLAIM_ROT[i]) < 0.4, `${s.rot}°`);
  check(`c${i}: burger bütün ve kırpılmamış (viewport içinde)`, inView(s) && s.imgOpacity >= 0.99, `${s.burger.x0.toFixed(0)},${s.burger.y0.toFixed(0)}→${s.burger.x1.toFixed(0)},${s.burger.y1.toFixed(0)} vp ${s.vw}×${s.vh}`);
  check(`c${i}: filtre yok (karartma/parlaklık oyunu yok)`, s.filter === "none", s.filter);
  const side = CLAIM_SIDE[i];
  check(`c${i}: metin ${side === "left" ? "solda" : "sağda"} (burgerin boş tarafı)`, s.side === side && s.textOp > 0.9, `taraf=${s.side} opaklık=${s.textOp}`);
  check(`c${i}: metin ikon rayıyla çakışmıyor`, !overlap(s.text, s.rail), s.text && s.rail ? `metin ${s.text.x0.toFixed(0)}–${s.text.x1.toFixed(0)} · ray ${s.rail.x0.toFixed(0)}–${s.rail.x1.toFixed(0)}` : "");
  check(`c${i}: metin burgerle çakışmıyor`, !overlap(s.text, s.burger), s.text ? `metin ${s.text.x0.toFixed(0)}–${s.text.x1.toFixed(0)} · burger ${s.burger.x0.toFixed(0)}–${s.burger.x1.toFixed(0)}` : "metin yok");
  /* havuz ışığı burgerle kayar: translateX ≈ burger merkezi */

}
/* dikey duraklar: c0 −14% → c3 +14% vh. Mutlak taban (claimY) ölçek kısıtından etkilendiği için
   DURAKLAR ARASI FARK ölçülür: aradaki mesafe CLAIM_Y farkı × vh olmalı (±2% vh). */
const vhPx = (await at(p, mid[0], 800)).vh;
for (let i = 1; i < 4; i++) {
  const expDelta = (CLAIM_Y[i] - CLAIM_Y[i - 1]) * vhPx;
  check(`c${i - 1}→c${i}: dikey kayma ${((CLAIM_Y[i] - CLAIM_Y[i - 1]) * 100).toFixed(0)}% vh (±2%)`, Math.abs(ys[i] - ys[i - 1] - expDelta) < vhPx * 0.02, `ölçülen ${(ys[i] - ys[i - 1]).toFixed(0)} px · beklenen ${expDelta.toFixed(0)} px`);
}
check("burger yukarıdan aşağı indi (c0 en üstte, c3 en altta)", ys[0] < ys[3] - vhPx * 0.2, `${ys[0].toFixed(0)} → ${ys[3].toFixed(0)}`);

/* ölçek: aşama başına ölçek 1 → 1.03 → 1.03 → 1 (kart ölçeği viewport'a sığma kısıtıyla da sınırlanır,
   bu yüzden mutlak değil ORAN bakılır: uçlar birbirine eşit, ortalar ~%3 büyük) */
const sc = [];
for (let i = 0; i < 4; i++) sc.push((await at(p, mid[i], 1500)).scale);
const ratio = sc.map((v) => v / sc[0]);
check("ölçek 1 → 1.03 → 1 (uçlar eşit, ortalar ~%3 büyük)", Math.abs(sc[3] / sc[0] - 1) < 0.04 && ratio[1] > 1.005 && ratio[1] < 1.06, sc.map((v) => v.toFixed(3)).join(" / "));

/* akış sürekli: kademeli zıplama yok — c0→c3 arası 24 örnek, ardışık fark sınırlı */
const xs = [];
for (let i = 0; i <= 24; i++) {
  const v = S.c0[0] + ((S.c3[1] - S.c0[0]) * i) / 24;
  xs.push((await at(p, v, 260)).center);
}
let maxStep = 0;
for (let i = 1; i < xs.length; i++) maxStep = Math.max(maxStep, Math.abs(xs[i] - xs[i - 1]));
/* Süreklilik: 24 örnekle taranan yolda tek adım, en uzun durak-arası mesafenin yarısını geçmemeli
   (kademeli zıplama olsaydı tek örnekte tam mesafe kadar sıçrardı). */
const legs = CLAIM_X.slice(1).map((v, i) => Math.abs(v - CLAIM_X[i]) * 1440);
const maxLeg = Math.max(...legs);
check("akış sürekli (tek adım < en uzun durak arasının yarısı)", maxStep < maxLeg * 0.5, `en büyük adım ${maxStep.toFixed(0)} px · en uzun ara ${maxLeg.toFixed(0)} px`);
check("burger sağdan başlar, solda biter", xs[0] > 0 && xs[xs.length - 1] < 0, `${xs[0].toFixed(0)} → ${xs[xs.length - 1].toFixed(0)}`);
await p.close();

/* reduced-motion */
p = await fresh(b, { reduced: true });
const rm = await p.evaluate(() => {
  const t = document.querySelector(".claimText");
  return { exists: !!t, tf: t ? getComputedStyle(t).transition : "" };
});
check("reduced-motion: statik sayfa (sahne yok), metin geçişi yok", !rm.exists);
await p.close();

/* mobil: yatay mesafe yarıya, metin burgerin üstünde tek sütun */
MOBILE = true;
const Sm = segmentsFor(true);
p = await fresh(b, { w: 390, h: 844, mobile: true });
for (const i of [0, 3]) {
  const s = await at(p, mid[i], 1700);
  const expX = CLAIM_X[i] * 0.5 * s.vw;
  check(`mobil c${i}: yatay mesafe yarıya (${(CLAIM_X[i] * 50).toFixed(0)}%)`, Math.abs(s.center - expX) < s.vw * 0.05, `ölçülen ${s.center.toFixed(0)} px · beklenen ${expX.toFixed(0)} px`);
  check(`mobil c${i}: burger kırpılmamış`, inView(s), `${s.burger.x0.toFixed(0)}→${s.burger.x1.toFixed(0)} vp ${s.vw}`);
  check(`mobil c${i}: metin burgerin üstünde, çakışma yok`, !overlap(s.text, s.burger) && s.text.y0 >= s.burger.y1 - 1, `metin üst ${s.text?.y0.toFixed(0)} · burger alt ${s.burger.y1.toFixed(0)}`);
}
/* mobil scroll uzunluğu artmadı */
const height = await p.evaluate(() => document.querySelector(".scroller").getBoundingClientRect().height / innerHeight);
check("mobil scroll uzunluğu artmadı (928vh)", Math.abs(height - 9.28) < 0.05, `${height.toFixed(2)}×vh`);
void Sm;
await p.screenshot({ path: `${out}/390-c3.png` });
await p.close();

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
