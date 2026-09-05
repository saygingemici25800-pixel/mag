// İddia bölümü — hero fotoğrafının dilimleri (public/assets/dilim):
//  - tek burger: fotoğraf ve dilimler aynı karede birlikte görünmez (takas .item.sliced ile tek karede)
//  - aralık kapalıyken dört dilim üst üste = orijinal fotoğraf (canvas piksel karşılaştırması)
//  - yalnızca translateY (yana kayma yok), hiçbir dilim viewport dışına taşmaz, metin bloğuyla çakışmaz
//  - ışık: aktif dilim 1, diğerleri .12; ışık elipsi meta.json bandCenterPct'sine oturur; aynı anda iki dilim aydınlık olmaz
//  - reduced-motion: aralık açık, dönme yok; mobil: aralık daha küçük
//  - eski katman sistemi (katman/, Explode, hasLayers) kalmadı
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { mapP } from "./_segments.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/dilim";
const root = process.argv[4] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
mkdirSync(out, { recursive: true });
const META = JSON.parse(readFileSync(path.join(root, "public/assets/dilim/meta.json"), "utf8"));
const CLAIM_SLICE = [2, 0, 2, 1]; // stageMath.CLAIM_SLICE ile aynı
const SHIFT = [-1.6, -0.55, 0.55, 1.6];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

/* ---- statik: ölü kod yok ---- */
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = ["components", "lib", "app", "scripts"].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(ts|tsx|mjs|css)$/.test(f));
const dead = src.filter((f) => /assets\/katman|lib\/katman|hasLayers|\bExplode\b|exLayer|LAYER_ORDER|stagesFor|STAGE_KEYS/.test(readFileSync(f, "utf8")));
check("eski katman sistemi kaynakta yok (katman/hasLayers/Explode/exLayer)", dead.length === 0, dead.map((f) => path.relative(root, f)).join(" "));
check("public/assets/katman ve Explode.tsx silindi", !existsSync(path.join(root, "public/assets/katman")) && !existsSync(path.join(root, "components/stage/Explode.tsx")));
check("meta.json 5 ürün × 4 bandCenterPct", Object.keys(META).length === 5 && Object.values(META).every((m) => m.bandCenterPct.length === 4));

/* ---- çalışma zamanı ---- */
const probe = (p) => p.evaluate(() => {
  const item = document.querySelector(".item.focus");
  const img = item?.querySelector(":scope > picture > img");
  const sl = item?.querySelector(".slices");
  const cs = (el) => getComputedStyle(el);
  const imgVis = !!img && cs(img).visibility !== "hidden" && cs(item).display !== "none";
  const slVis = !!sl && cs(sl).display !== "none";
  const slices = sl ? [...sl.querySelectorAll("img")].map((s) => {
    const m = new DOMMatrixReadOnly(cs(s).transform); const r = s.getBoundingClientRect();
    return { op: +cs(s).opacity.slice(0, 5), tx: +m.e.toFixed(1), ty: +m.f.toFixed(1), a: +m.a.toFixed(3), b: +m.b.toFixed(3), x0: r.x, x1: r.right, y0: r.y, y1: r.bottom, h: s.offsetHeight };
  }) : [];
  const light = sl?.querySelector(".sLight");
  const box = item?.getBoundingClientRect(); // döndürülmemiş kutu: .item (rotate 0), dilimler aynı kutuda
  const M = sl ? new DOMMatrixReadOnly(cs(sl).transform) : null;
  const left = document.querySelector(".left")?.getBoundingClientRect();
  return {
    id: item?.dataset.k, imgVis, slVis, cls: sl?.className ?? "", itemCls: item?.className ?? "", slices,
    light: light ? { op: +cs(light).opacity, top: light.getBoundingClientRect().y + light.getBoundingClientRect().height / 2, h: light.getBoundingClientRect().height } : null,
    box: box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null,
    rot: M ? +((Math.atan2(M.b, M.a) * 180) / Math.PI).toFixed(2) : 0, gap: sl ? cs(sl).getPropertyValue("--gap").trim() : "",
    left: left ? { x0: left.x, x1: left.right, y0: left.y, y1: left.bottom } : null, vw: innerWidth, vh: innerHeight,
    filters: sl ? [...sl.querySelectorAll("img")].map((s) => cs(s).filter).join("|") : "",
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
const oneBurger = (s) => (s.imgVis ? 1 : 0) + (s.slVis ? 1 : 0) === 1;
const litCount = (s) => s.slices.filter((x) => x.op > 0.6).length;

const b = await chromium.launch();
let p = await fresh(b);

/* kapalı → açık takas */
const before = await at(p, 0.29);
check("P_IN öncesi: fotoğraf görünür, dilimler gizli", before.imgVis && !before.slVis, before.itemCls);
const open0 = await at(p, 0.31);
check("c0: takas yapıldı (item.sliced), fotoğraf gizli, dilimler açık", !open0.imgVis && open0.slVis && /open a2/.test(open0.cls), open0.cls);
check("her karede tek burger (P_IN öncesi/sonrası)", oneBurger(before) && oneBurger(open0));

/* kapalı dilimler = fotoğraf: canvas karşılaştırması (aynı kutu, aynı boyut) */
const eq = await p.evaluate(async () => {
  const item = document.querySelector(".item.focus");
  const img = item.querySelector(":scope > picture > img");
  const sl = [...item.querySelectorAll(".slices img")];
  await Promise.all([img, ...sl].map((i) => i.decode().catch(() => {})));
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = (draw) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); draw(x); return x.getImageData(0, 0, W, H).data; };
  const A = cv((x) => x.drawImage(img, 0, 0, W, H));
  const B = cv((x) => sl.forEach((s) => x.drawImage(s, 0, 0, W, H)));
  let bad = 0, sumA = 0, n = 0, seam = 0;
  for (let i = 0; i < A.length; i += 4) {
    const aA = A[i + 3], aB = B[i + 3];
    if (aA < 8 && aB < 8) continue;
    n++;
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    const da = Math.abs(aA - aB);
    if (d > 24 && aA > 200 && aB > 200) bad++;
    if (da > 24) seam++;
    sumA += da;
  }
  return { W, H, n, bad, seam, meanAlphaDiff: +(sumA / n).toFixed(2), sliceNatural: sl.map((s) => s.naturalWidth + "x" + s.naturalHeight).join(",") };
});
check("dilimler fotoğrafla aynı boyut (natural)", eq.sliceNatural.split(",").every((s) => s === `${eq.W}x${eq.H}`), eq.sliceNatural);
check("kapalı dilimler ≡ fotoğraf: renk farkı > 24 olan opak piksel < %0.5", eq.bad / eq.n < 0.005, `${eq.bad}/${eq.n}`);
check("kesim çizgilerinde alfa farkı sınırlı (< %4 piksel)", eq.seam / eq.n < 0.04, `${eq.seam}/${eq.n} · ort. alfa farkı ${eq.meanAlphaDiff}`);

/* hareket: yalnızca translateY, sahne rotate(-1.4deg) */
const mv = open0.slices;
check("dilimlerde yana kayma yok (tx = 0), yalnızca translateY", mv.every((s) => s.tx === 0) && mv.some((s) => s.ty !== 0), mv.map((s) => `${s.tx},${s.ty}`).join(" "));
check("dilim transform'unda ölçek/döndürme yok (a=1, b=0)", mv.every((s) => s.a === 1 && s.b === 0));
const expShift = SHIFT.map((k, i) => k * 0.046 * mv[i].h); // yerel px: görsel yüksekliğinin yüzdesi (ölçek öncesi)
check("kayma oranları [-1.6,-.55,.55,1.6] × 4.6% (görsel yüksekliği, ±1 px)", mv.every((s, i) => Math.abs(s.ty - expShift[i]) < 1), mv.map((s) => s.ty).join(" ") + ` (beklenen ${expShift.map((v) => v.toFixed(1)).join(" ")})`);
check("sahne açıkken rotate(-1.4deg)", Math.abs(open0.rot + 1.4) < 0.05, String(open0.rot));
check("filtre yok (karartma opaklıkla)", open0.filters.split("|").every((f) => f === "none"), open0.filters);
check("hiçbir dilim viewport dışında değil", mv.every((s) => s.x0 >= -1 && s.x1 <= open0.vw + 1 && s.y0 >= -1 && s.y1 <= open0.vh + 1), mv.map((s) => `${s.x0.toFixed(0)},${s.y0.toFixed(0)}→${s.x1.toFixed(0)},${s.y1.toFixed(0)}`).join(" ") + ` vp ${open0.vw}×${open0.vh}`);

/* ışık: aktif dilim 1, diğerleri .12, ışık merkezi bandCenterPct */
const stages = [[0.31, 0], [0.42, 1], [0.50, 2], [0.58, 3]];
for (const [v, ci] of stages) {
  const s = await at(p, v, 1700);
  const act = CLAIM_SLICE[ci];
  const ok = s.slices.every((x, i) => (i === act ? x.op >= 0.98 : Math.abs(x.op - 0.12) < 0.02));
  check(`c${ci}: aktif dilim ${act} = 1, diğerleri .12`, ok && new RegExp(`\\ba${act}\\b`).test(s.cls), s.slices.map((x) => x.op).join(" "));
  const m = META[s.id];
  const scale = s.box.h / s.slices[act].h;
  const expTop = s.box.y + (m.bandCenterPct[act] / 100) * s.box.h + s.slices[act].ty * scale;
  check(`c${ci}: ışık merkezi meta bandCenterPct[${act}]=${m.bandCenterPct[act]}% (+kayma)`, !!s.light && s.light.op > 0.95 && Math.abs(s.light.top - expTop) < 6, `ölçülen ${s.light?.top.toFixed(1)} · beklenen ${expTop.toFixed(1)}`);
  check(`c${ci}: tek burger`, oneBurger(s));
}
/* geçişte aynı anda iki dilim aydınlık olmaz: c2 → c3 arası 50 ms örnekleme */
await at(p, 0.50, 1200);
await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(0.58, false));
let maxLit = 0; const trace = [];
for (let i = 0; i < 26; i++) { await p.waitForTimeout(50); const s = await probe(p); maxLit = Math.max(maxLit, litCount(s)); trace.push(s.slices.map((x) => x.op.toFixed(2)).join("/")); }
check("c2→c3 geçişinde hiçbir karede iki dilim > .6 değil", maxLit <= 1, "örnek: " + trace.filter((_, i) => i % 5 === 0).join("  "));

/* kapanış: P_OUT sonrası fotoğraf geri, dilimler gizli */
const after = await at(p, 0.615, 1600);
check("P_OUT sonrası: fotoğraf görünür, dilimler gizli", after.imgVis && !after.slVis, after.itemCls);
check("her karede tek burger (P_OUT sonrası)", oneBurger(after));
await p.close();

/* reduced-motion: sahne yok, statik sayfa — iddia kartlarında dilimler sabit açık, dönme yok, vurgu opaklıkla */
p = await fresh(b, { reduced: true });
const rm = await p.evaluate(() => {
  const figs = [...document.querySelectorAll(".sliceFig .slices")];
  const cs = (el) => getComputedStyle(el);
  return figs.map((f) => ({ cls: f.className, rot: cs(f).transform, s: [...f.querySelectorAll("img.s")].map((i) => { const m = new DOMMatrixReadOnly(cs(i).transform); return { op: +cs(i).opacity, tx: m.e, ty: +m.f.toFixed(1) }; }) }));
});
check("reduced-motion: 4 iddia kartında dilimler sabit açık, dönme yok", rm.length === 4 && rm.every((f) => /open/.test(f.cls) && f.rot === "none" && f.s.some((x) => x.ty !== 0) && f.s.every((x) => x.tx === 0)), rm.map((f) => f.rot).join("|"));
check("reduced-motion: vurgu yalnızca opaklıkla (aktif 1, diğerleri .12), iddia→dilim eşlemesi", rm.every((f, ci) => f.s.every((x, i) => (i === CLAIM_SLICE[ci] ? x.op >= 0.98 : Math.abs(x.op - 0.12) < 0.02))));
await p.close();

/* mobil */
MOBILE = true;
p = await fresh(b, { w: 390, h: 844, mobile: true });
const mb = await at(p, 0.42, 1700);
check("mobil: dilimler açık, aralık daha küçük (--gap 3.2%)", mb.slVis && mb.gap === "3.2%", mb.gap);
check("mobil: hiçbir dilim viewport dışında değil", mb.slices.every((s) => s.x0 >= -1 && s.x1 <= mb.vw + 1 && s.y0 >= -1 && s.y1 <= mb.vh + 1), mb.slices.map((s) => `${s.x0.toFixed(0)},${s.y0.toFixed(0)}→${s.x1.toFixed(0)},${s.y1.toFixed(0)}`).join(" ") + ` vp ${mb.vw}×${mb.vh}`);
const sy1 = Math.max(...mb.slices.filter((s) => s.op > 0.05).map((s) => s.y1));
check("mobil: burger metin bloğuyla çakışmıyor", !!mb.left && sy1 <= mb.left.y0 + 1, `burger alt ${sy1.toFixed(0)} · metin üst ${mb.left?.y0.toFixed(0)}`);
check("mobil: tek burger, tek dilim aydınlık", oneBurger(mb) && litCount(mb) === 1);
await p.screenshot({ path: `${out}/390-c1.png` });
await p.close();

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
