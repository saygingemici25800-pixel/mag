// Hero ok işaretleri (Ciao Energy dili)
//  - eski 56 px daire butonlar KALKTI; her yanda üç ince chevron
//  - konum ÇALIŞMA ZAMANINDA: odaktaki ürünün sınır kutusunun 28 px dışı (mobilde 16 px),
//    ekran kenarına 40 px'ten fazla yaklaşmaz — sabit piksel yok
//  - dikeyde ürünün ortası
//  - küçük ve soluk: ~10 px, opaklık 0.55 → 0.30 → 0.15
//  - tıklama ürün değiştirir (sol önceki, sağ sonraki), klavye çalışır, dokunma alanı 44 px
//  - aşağı ok: ilk kaydırmadan sonra kaybolur ve geri gelmez
//  - hero görünmezken animasyon durur; reduced-motion'da hareket yok
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapP } from "./_segments.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik: eski buton kalıntısı kalmasın, sabit piksel yazılmasın ---- */
const heroSrc = readFileSync(path.join(root, "components/stage/Hero.tsx"), "utf8");
const cssSrc = readFileSync(path.join(root, "components/stage/stage.css"), "utf8");
const mathSrc = readFileSync(path.join(root, "components/stage/stageMath.ts"), "utf8");
check("56 px daire buton kaldırıldı", !/\bnav arrow\b/.test(heroSrc) && !/width:\s*56px/.test(cssSrc));
check("konum çalışma zamanından (--arrowGap)", /--arrowGap/.test(cssSrc) && /arrows\.gap/.test(readFileSync(path.join(root, "components/stage/Stage.tsx"), "utf8")));
check("ok boşluğu sabit değil, üründen türer", /contentHeight\(card, arAtFocus\)/.test(mathSrc) && /ARROW_GAP/.test(mathSrc));
check("filter kullanılmıyor (kare maliyeti)", !/\.hnav[^{]*\{[^}]*filter:/.test(cssSrc) && !/\.shint[^{]*\{[^}]*filter:/.test(cssSrc));

const b = await chromium.launch();
const settle = async (p) => {
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(1300);
};
/* Görselin GERÇEK çizilen kutusu: object-fit contain, element kutusu ≠ boyanan alan */
const drawn = (p) => p.evaluate(() => {
  const img = document.querySelector(".item.focus img.img");
  const box = img.getBoundingClientRect();
  const s = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  const l = box.left + (box.width - dw) / 2;
  const t = box.top + (box.height - dh) / 2;
  const L = document.querySelector(".hnav.l").getBoundingClientRect();
  const R = document.querySelector(".hnav.r").getBoundingClientRect();
  return {
    ürün: { l: Math.round(l), r: Math.round(l + dw), cy: Math.round(t + dh / 2), w: Math.round(dw) },
    sol: { l: Math.round(L.left), r: Math.round(L.right), cy: Math.round(L.top + L.height / 2), w: Math.round(L.width), h: Math.round(L.height) },
    sağ: { l: Math.round(R.left), r: Math.round(R.right), cy: Math.round(R.top + R.height / 2), w: Math.round(R.width), h: Math.round(R.height) },
    vw: innerWidth,
  };
});

/* ---- KONUM ---- */
for (const [w, h, label, gap] of [[1440, 900, "masaüstü", 28], [1024, 768, "tablet", 28], [390, 844, "mobil", 16]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const r = await drawn(p);
  /* dikey: ürünün ortası */
  check(`${label}: dikeyde ürünün ortası`, Math.abs(r.sol.cy - r.ürün.cy) <= 2 && Math.abs(r.sağ.cy - r.ürün.cy) <= 2, `ok ${r.sol.cy} vs ürün ${r.ürün.cy}`);
  /* yatay: ya istenen boşluk, ya da kenar sınırı devrede */
  const solB = r.ürün.l - r.sol.r, sağB = r.sağ.l - r.ürün.r;
  const kenarda = r.sol.l <= 41 || r.vw - r.sağ.r <= 41;
  check(`${label}: boşluk ${gap} px ya da kenar sınırı`, kenarda || (Math.abs(solB - gap) <= 2 && Math.abs(sağB - gap) <= 2), `sol ${solB}px sağ ${sağB}px${kenarda ? " (kenar sınırı devrede)" : ""}`);
  check(`${label}: ekran kenarına ≥40 px`, r.sol.l >= 39 && r.vw - r.sağ.r >= 39, `sol ${r.sol.l} sağ ${r.vw - r.sağ.r}`);
  check(`${label}: iki grup da ekran içinde`, r.sol.l >= 0 && r.sağ.r <= r.vw, `${r.sol.l} … ${r.sağ.r}/${r.vw}`);
  /* dokunma alanı */
  check(`${label}: dokunma alanı ≥44 px`, r.sol.w >= 44 && r.sol.h >= 44 && r.sağ.w >= 44, `${r.sol.w}×${r.sol.h}`);
  await p.close();
}

/* ---- GÖRÜNÜM: küçük, soluk, kademeli ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const r = await p.evaluate(() => {
    const chevs = [...document.querySelectorAll(".hnav.r .chev")];
    const box = chevs[0].getBoundingClientRect();
    /* Animasyon opaklığı oynatıyor, --base ise calc() metni olarak geliyor (sayı değil).
       Bu yüzden animasyonu geçici durdurup GERÇEK opaklığı okuyoruz. */
    const prev = chevs.map((c) => c.style.animation);
    chevs.forEach((c) => { c.style.animation = "none"; });
    void chevs[0].offsetWidth;
    const base = chevs.map((c) => parseFloat(getComputedStyle(c).opacity));
    chevs.forEach((c, i) => { c.style.animation = prev[i]; });
    const sw = getComputedStyle(chevs[0].querySelector("path")).strokeWidth;
    return { adet: chevs.length, w: Math.round(box.width), h: Math.round(box.height), base, sw,
      solAdet: document.querySelectorAll(".hnav.l .chev").length };
  });
  check("her yanda 3 chevron (toplam 6)", r.adet === 3 && r.solAdet === 3, `sol ${r.solAdet} sağ ${r.adet}`);
  check("küçük (~10 px)", r.w <= 14 && r.h <= 14, `${r.w}×${r.h}px`);
  check("ince çizgi (≤1.5)", parseFloat(r.sw) <= 1.5, r.sw);
  check("dışa doğru soluklaşır 0.55 → 0.30 → 0.15", Math.abs(r.base[0] - 0.55) < 0.02 && Math.abs(r.base[1] - 0.35) < 0.06 && Math.abs(r.base[2] - 0.15) < 0.02, r.base.join(" / "));
  await p.close();
}

/* ---- DALGA: içten dışa 120 ms gecikme, 2.4 sn döngü ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const r = await p.evaluate(() => {
    const g = (sel) => [...document.querySelectorAll(sel)].map((c) => {
      const cs = getComputedStyle(c);
      return { d: cs.animationDelay, dur: cs.animationDuration, name: cs.animationName };
    });
    return { sağ: g(".hnav.r .chev"), sol: g(".hnav.l .chev"), hint: g(".shint .chev") };
  });
  check("yan ok döngüsü 2.4 sn", r.sağ.every((x) => x.dur === "2.4s"), r.sağ[0]?.dur);
  check("sağda içten dışa 120 ms gecikme", r.sağ.map((x) => x.d).join(",") === "0s,0.12s,0.24s", r.sağ.map((x) => x.d).join(","));
  /* solda "iç" olan sağdaki chevron: gecikme ters sırada olmalı */
  check("solda da içten dışa (ters sıra)", r.sol.map((x) => x.d).join(",") === "0.24s,0.12s,0s", r.sol.map((x) => x.d).join(","));
  check("aşağı ok döngüsü 4 sn", r.hint.every((x) => x.dur === "4s"), r.hint[0]?.dur);
  check("aşağı ok yukarıdan aşağıya", r.hint.map((x) => parseFloat(x.d)).every((v, i, a) => i === 0 || v > a[i - 1]), r.hint.map((x) => x.d).join(","));
  await p.close();
}

/* ---- TIKLAMA: ürün değişir ---- */
for (const [w, h, label] of [[1440, 900, "masaüstü"], [390, 844, "mobil"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const name = () => p.evaluate(() => document.querySelector(".hname")?.textContent.trim());
  const a = await name();
  await p.click(".hnav.r");
  await p.waitForTimeout(900);
  const bn = await name();
  check(`${label}: sağ ok SONRAKİ ürüne geçirdi`, bn !== a && !!bn, `${a} → ${bn}`);
  await p.click(".hnav.l");
  await p.waitForTimeout(900);
  const c = await name();
  check(`${label}: sol ok ÖNCEKİ ürüne döndürdü`, c === a, `${bn} → ${c}`);
  /* klavye */
  await p.focus(".hnav.r");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(900);
  check(`${label}: klavye (Enter) çalışıyor`, (await name()) !== c);
  const aria = await p.evaluate(() => ({
    l: document.querySelector(".hnav.l")?.getAttribute("aria-label"),
    r: document.querySelector(".hnav.r")?.getAttribute("aria-label"),
  }));
  check(`${label}: aria-label var`, !!aria.l && !!aria.r, `${aria.l} / ${aria.r}`);
  await p.close();
}

/* ---- AŞAĞI OK: ilk kaydırmadan sonra kaybolur ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  check("başta kaydırma ipucu var", await p.evaluate(() => !!document.querySelector(".shint")));
  const bar = await p.evaluate(() => {
    const s = document.querySelector(".shint").getBoundingClientRect();
    const t = document.querySelector(".bar").getBoundingClientRect();
    return { hintBot: Math.round(s.bottom), barTop: Math.round(t.top) };
  });
  check("ipucu ilerleme çubuğunun ÜSTÜNDE", bar.hintBot <= bar.barTop, `ipucu alt ${bar.hintBot} vs çubuk üst ${bar.barTop}`);
  await p.evaluate(() => window.scrollTo(0, 300));
  await p.waitForTimeout(700);
  check("kaydırınca ipucu kayboldu", await p.evaluate(() => !document.querySelector(".shint")));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(900);
  check("geri dönünce BİR DAHA görünmüyor", await p.evaluate(() => !document.querySelector(".shint")));
  await p.close();
}

/* ---- KARE SÜRESİ: hero görünmezken animasyon durur ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const play = () => p.evaluate(() => getComputedStyle(document.querySelector(".hnav .chev")).animationPlayState);
  check("hero'da animasyon çalışıyor", (await play()) === "running");
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(0.5, false));
  await p.waitForTimeout(1500);
  check("hero görünmezken animasyon DURUYOR", (await play()) === "paused");
  await p.close();
}


/* ---- KÖŞE OKLARI (dekoratif) ----
   Gezinme okları (.hnav) ile karışmasın: ikisi ayrı ve .hnav'a dokunulmadı. */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const g = await p.evaluate(() => {
    const L = document.querySelector(".cnr.l"), R = document.querySelector(".cnr.r");
    if (!L || !R) return null;
    const lb = L.getBoundingClientRect(), rb = R.getBoundingClientRect();
    const cs = [...L.querySelectorAll(".cchev")].map((c) => Math.round(c.getBoundingClientRect().height));
    const bar = document.querySelector(".bar").getBoundingClientRect();
    const cnt = document.querySelector(".counter").getBoundingClientRect();
    const ov = (a, b2) => !(a.right <= b2.left || b2.right <= a.left || a.bottom <= b2.top || b2.bottom <= a.top);
    const st = getComputedStyle(L.querySelector(".cchev"));
    return {
      okSayısı: cs.length, okYük: cs, okGen: Math.round(L.querySelector('.cchev').getBoundingClientRect().width), grupYük: Math.round(lb.height),
      dikeyYüzde: Math.round((lb.top + lb.height / 2) / innerHeight * 100),
      solKenar: Math.round(lb.left), sağKenar: Math.round(innerWidth - rb.right),
      çubukÇakışma: ov(lb, bar) || ov(rb, bar), sayaçÇakışma: ov(lb, cnt) || ov(rb, cnt),
      ekranİçinde: lb.left >= 0 && rb.right <= innerWidth,
      ariaHidden: L.getAttribute("aria-hidden"), pe: getComputedStyle(L).pointerEvents,
      filtre: st.filter, fill: st.fill, cap: st.strokeLinecap,
      hnavVar: !!document.querySelector(".hnav.l") && !!document.querySelector(".hnav.r"),
    };
  });
  check("köşe okları var (iki grup)", !!g);
  check("her grupta 3 ok", g.okSayısı === 3, String(g.okSayısı));
  /* 11 Eyl 2026: oklar AŞAĞI baktığı için kutu döndü — ok 80×40 (önce 40×80).
     Ölçüt okun UZUN kenarı (~80 px) ve grup yüksekliği (~164 px). */
  check("ok ~80 px (uzun kenar), grup ~150-175 px", g.okGen >= 70 && g.okGen <= 90 && g.grupYük >= 140 && g.grupYük <= 180, `ok ${g.okGen}×${g.okYük[0]} · grup ${g.grupYük}`);
  check("dikeyde ~%80", Math.abs(g.dikeyYüzde - 80) <= 3, `%${g.dikeyYüzde}`);
  check("kenardan içeride, taşma yok", g.ekranİçinde && g.solKenar >= 12 && g.sağKenar >= 12, `sol ${g.solKenar} sağ ${g.sağKenar}`);
  check("ilerleme çubuğunu kapatmıyor", !g.çubukÇakışma);
  check("sayacı kapatmıyor", !g.sayaçÇakışma);
  check("dekoratif: aria-hidden + tıklanamaz", g.ariaHidden === "true" && g.pe === "none");
  check("filter yok", g.filtre === "none", g.filtre);
  check("dolgu yok, uçlar yuvarlak", g.fill === "none" && g.cap === "round", `${g.fill} / ${g.cap}`);
  check("gezinme okları (.hnav) DURUYOR", g.hnavVar);

  /* SIRA: üst → orta → alt → toplu flaş → bekleme. Web Animations API ile ölçülür;
     CSS animationDelay ile "duraklat + faz ver" yöntemi yarışıyordu. */
  const seq = await p.evaluate(() => {
    const cs = [...document.querySelectorAll(".cnr.r .cchev")];
    const anims = cs.map((c) => c.getAnimations()[0]);
    if (anims.some((a) => !a)) return null;
    anims.forEach((a) => a.pause());
    const at = (t) => { anims.forEach((a) => { a.currentTime = t; }); return cs.map((c) => parseFloat(getComputedStyle(c).opacity)); };
    return { ust: at(70), orta: at(280), alt: at(420), toplu: at(630), bekleme: at(1100) };
  });
  check("faz 1: yalnızca ÜSTTEKİ yanık", seq.ust[0] > 0.6 && seq.ust[1] < 0.3 && seq.ust[2] < 0.3, seq.ust.map((v) => v.toFixed(2)).join(" "));
  check("faz 2: yalnızca ORTADAKİ yanık", seq.orta[1] > 0.6 && seq.orta[0] < 0.3 && seq.orta[2] < 0.3, seq.orta.map((v) => v.toFixed(2)).join(" "));
  check("faz 3: yalnızca ALTTAKİ yanık", seq.alt[2] > 0.6 && seq.alt[0] < 0.3 && seq.alt[1] < 0.3, seq.alt.map((v) => v.toFixed(2)).join(" "));
  check("faz 4: ÜÇÜ BİRDEN yanık (senkron)", seq.toplu.every((v) => v > 0.6), seq.toplu.map((v) => v.toFixed(2)).join(" "));
  check("faz 5: bekleme (hepsi sönük)", seq.bekleme.every((v) => v < 0.3), seq.bekleme.map((v) => v.toFixed(2)).join(" "));
  check("yanma aralığı 0.15 → ~0.9", Math.abs(Math.min(...seq.bekleme) - 0.15) < 0.02 && Math.max(...seq.toplu) > 0.75);
  await p.close();
}

/* hero görünmezken animasyon durur */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const play = () => p.evaluate(() => getComputedStyle(document.querySelector(".cchev")).animationPlayState);
  check("köşe okları hero'da çalışıyor", (await play()) === "running");
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(0.5, false));
  await p.waitForTimeout(1500);
  check("hero görünmezken köşe okları DURUYOR", (await play()) === "paused");
  await p.close();
}

/* ---- prefers-reduced-motion ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  /* Sahne tamamen statik sürüme düşüyor: karusel yok, dolayısıyla yönlendirme oku da yok —
     tüm ürünler aynı anda listeleniyor, gidilecek gizli ürün kalmıyor. */
  const r = await p.evaluate(() => ({
    sahne: !!document.querySelector(".hnav"),
    statik: document.querySelectorAll("article").length,
  }));
  check("reduced-motion: statik sürüm (tüm ürünler listede)", !r.sahne && r.statik >= 5, `${r.statik} ürün kartı`);
  /* CSS kuralı yine de dursun: sahne sürümü açılırsa hareket olmasın */
  check("reduced-motion CSS kuralı var", /prefers-reduced-motion[^}]*\}[\s\S]{0,400}\.hnav \.chev/.test(cssSrc) || /\.hnav \.chev,\s*\.shint \.chev \{\s*animation: none/.test(cssSrc));
  /* köşe okları: reduced-motion'da animasyon yok, SABİT orta opaklık */
  check("reduced-motion: köşe okları sabit", /@media \(prefers-reduced-motion: reduce\) \{\s*\.cchev \{\s*animation: none;\s*opacity: 0\.45;/.test(cssSrc));
  await ctx.close();
}

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nTÜMÜ GEÇTİ");
process.exit(fail ? 1 : 0);
