// Preloader: shown = min(gerçek, geçen/2400) → en az 2.4 s; iki katmanlı logo (blur/wipe), kenar çizgisi,
// yükleme çizgisi + "YÜKLENİYOR · %NN", %100 vurgusu, 350 ms bekleme, 600 ms kalkış; reduced-motion.
// Ayrıca ilk boyama → kalkış süresini ölçer ve %15 / %55 / %100 karelerini alır.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/preloader";
mkdirSync(out, { recursive: true });
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const probe = (p) => p.evaluate(() => {
  const pre = document.querySelector(".pre");
  const now = performance.now();
  if (!pre) return { gone: true, now };
  const sharp = pre.querySelector(".preSharp"), basei = pre.querySelector(".preBase"), edge = pre.querySelector(".preEdge");
  return {
    now, gone: false, p: parseFloat(pre.style.getPropertyValue("--p") || "0"), cls: pre.className,
    clip: sharp?.style.clipPath ?? "", blur: parseFloat(basei?.style.filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? "16"),
    baseDisplay: basei ? getComputedStyle(basei).display : "none", edgeOp: parseFloat(edge?.style.opacity || "0"), edgeLeft: edge?.style.left ?? "",
    bar: pre.querySelector(".preBar i")?.style.transform ?? "", num: pre.querySelector(".preNum")?.textContent ?? "",
    logoOp: parseFloat(getComputedStyle(pre.querySelector(".preLogo")).opacity),
  };
});
const firstPaint = (p) => p.evaluate(() => { const e = performance.getEntriesByType("paint").find((x) => x.name === "first-paint" || x.name === "first-contentful-paint"); return e ? e.startTime : null; });

const b = await chromium.launch();
for (const vp of [{ w: 1440, h: 860 }, { w: 390, h: 844 }]) {
  const tag = `${vp.w}`;
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "/", { waitUntil: "commit" });
  const samples = []; const shots = { 15: false, 55: false, 100: false };
  let goneAt = null;
  for (let i = 0; i < 400 && goneAt === null; i++) {
    const s = await probe(p).catch(() => null);
    if (!s) continue;
    samples.push(s);
    if (s.gone) { goneAt = s.now; break; }
    for (const th of [15, 55]) if (!shots[th] && s.p * 100 >= th) { shots[th] = true; await p.screenshot({ path: `${out}/${tag}-%${th}.png` }); }
    if (!shots[100] && (s.p >= 1 || s.cls.includes("pop"))) { shots[100] = true; await p.screenshot({ path: `${out}/${tag}-%100.png` }); }
    await p.waitForTimeout(30);
  }
  const fp = await firstPaint(p);
  const live = samples.filter((s) => !s.gone);
  const first = live[0], reach = live.find((s) => s.p >= 1);
  /* ilk yazımdan önceki örnekte clip boş olabilir: ilk dolu clip'i al */
  const firstClip = live.find((s) => s.clip)?.clip ?? "";
  console.log(`  [${tag}] ilk boyama ${fp?.toFixed(0)} ms → preloader kalkışı ${goneAt?.toFixed(0)} ms  ⇒ toplam ${(goneAt - fp).toFixed(0)} ms (%100'e: ${reach ? (reach.now - fp).toFixed(0) : "?"} ms)`);
  check(`${tag} ilerleme kademeli`, new Set(live.map((s) => s.p.toFixed(2))).size >= 10, `${new Set(live.map((s) => s.p.toFixed(2))).size} ara değer`);
  check(`${tag} en az 2.4 s sürdü (ilk örnek → %100)`, reach && reach.now - first.now >= 2300, reach ? `${(reach.now - first.now).toFixed(0)} ms` : "yok");
  check(`${tag} toplam ≈ 2.4 s + 120 + 350 + 600`, goneAt && goneAt - first.now >= 3300 && goneAt - first.now < 5500, `${(goneAt - first.now).toFixed(0)} ms`);
  const mid = live.find((s) => s.p > 0.4 && s.p < 0.7);
  check(`${tag} alt katman blur 16 → 0`, first.blur >= 15 && mid && mid.blur < 10 && reach && reach.blur < 0.01, `${first.blur}→${mid?.blur}→${reach?.blur}`);
  /* tarayıcı inset(0 59% 0 0) → inset(0px 59.296% 0px 0px) normalize eder */
  const X = (c) => parseFloat(c.match(/inset\(0(?:px)? ([\d.]+)%/)?.[1] ?? "NaN");
  check(`${tag} üst katman soldan sağa açılır (clip-path)`, X(firstClip) > 50 && mid && X(mid.clip) > 25 && X(mid.clip) < 65 && reach && X(reach.clip) === 0, `${firstClip} → ${mid?.clip} → ${reach?.clip}`);
  check(`${tag} kenar çizgisi ortada görünür, %100'de gizli`, mid && mid.edgeOp === 0.8 && reach && reach.edgeOp === 0, `orta=${mid?.edgeOp} son=${reach?.edgeOp}`);
  check(`${tag} yükleme çizgisi ilerler`, mid && /scaleX\(0\.[4-6]/.test(mid.bar) && reach && /scaleX\(1/.test(reach.bar), `${mid?.bar} → ${reach?.bar}`);
  const badNum = live.filter((s) => !/YÜKLENİYOR · %\d+|LOADING · \d+%/.test(s.num));
  check(`${tag} "YÜKLENİYOR · %NN" her karede`, badNum.length === 0 && new Set(live.map((s) => s.num)).size >= 10, badNum.length ? `uymayan ${badNum.length}: ${JSON.stringify(badNum[0].num)} (p=${badNum[0].p}, cls=${badNum[0].cls})` : `${first.num} … ${reach?.num}`);
  check(`${tag} %100'de vurgu (pop)`, live.some((s) => s.cls.includes("pop")));
  check(`${tag} kalkış (gone) ve DOM'dan çıkış`, live.some((s) => s.cls.includes("gone")) && goneAt !== null);
  check(`${tag} sayfa hatası yok`, errs.length === 0, errs.join(" | "));
  await p.close();
}
/* yavaş cihaz/ağ: gerçek ilerleme 2.4 s'den uzun → o kadar sürer */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const cdp = await p.context().newCDPSession(p); await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 120, downloadThroughput: 700e3 / 8, uploadThroughput: 500e3 / 8 });
  await p.goto(base + "/", { waitUntil: "commit" });
  let first = null, reach = null;
  for (let i = 0; i < 700 && !reach; i++) { const s = await probe(p).catch(() => null); if (s && !s.gone) { first ??= s; if (s.p >= 1) reach = s; } await p.waitForTimeout(40); }
  check("yavaş ağda gerçek ilerlemeyi bekler (> 2.4 s)", reach && reach.now - first.now > 3500, reach ? `${(reach.now - first.now).toFixed(0)} ms` : "%100'e ulaşmadı");
  await p.close();
}
/* reduced-motion: blur/wipe yok, logo 300 ms fade-in, çizgi ilerler, yine ≥ 2.4 s */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 860 }, reducedMotion: "reduce" });
  await p.goto(base + "/", { waitUntil: "commit" });
  const live = []; let goneAt = null;
  for (let i = 0; i < 300 && goneAt === null; i++) { const s = await probe(p).catch(() => null); if (s) { if (s.gone) goneAt = s.now; else live.push(s); } await p.waitForTimeout(30); }
  /* hydration öncesi örnekleri (p=0, JS henüz yazmamış) dışarıda bırak */
  const hyd = live.filter((s) => s.p > 0);
  const first = hyd[0], reach = hyd.find((s) => s.p >= 1);
  check("reduced: preloader var", hyd.length > 0, `örnek=${hyd.length}`);
  check("reduced: alt (bulanık) katman yok", hyd.length > 0 && hyd.every((s) => s.baseDisplay === "none"), [...new Set(hyd.map((s) => s.baseDisplay))].join(","));
  check("reduced: üst katman kırpılmamış", live.every((s) => !/inset\(0 [1-9]/.test(getComputedClip(s))), live[1]?.clip);
  check("reduced: logo fade-in (bir ara opaklık < 1, sonda 1)", hyd.some((s) => s.logoOp < 1) && reach && reach.logoOp === 1, `min=${Math.min(...hyd.map((s) => s.logoOp))} → ${reach?.logoOp}`);
  check("reduced: çizgi ilerler", reach && /scaleX\(1/.test(reach.bar));
  check("reduced: yine en az 2.4 s", reach && reach.now - first.now >= 2300, reach ? `${(reach.now - first.now).toFixed(0)} ms` : "yok");
  await p.screenshot({ path: `${out}/1440-reduced.png` }).catch(() => {});
  await p.close();
}
function getComputedClip(s) { return s.clip; }
await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
