// Iddia bölümündeki "patlamış burger": doğru katman vurgusu, diğerlerinin kararması,
// manifestoda birleşme, reduced-motion davranışı ve hasLayers=false üründe fotoğrafın kalması.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/explode";
mkdirSync(out, { recursive: true });

/* claim → beklenen aktif katman(lar); c0..c3 ortaları */
const CLAIMS = [
  { n: "et", p: 0.33, active: ["et"] },
  { n: "ekmek", p: 0.42, active: ["ekmekUst", "ekmekAlt"] },
  { n: "peynir", p: 0.5, active: ["peynir"] },
  { n: "sos", p: 0.58, active: ["sos"] },
];
const ALL = ["ekmekUst", "sos", "peynir", "et", "ekmekAlt"];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const at = async (p, pr, settle = 1500) => {
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, pr);
  await p.waitForTimeout(settle);
  return p.evaluate(() => {
    const ex = document.querySelector(".explode");
    const layers = {};
    for (const e of document.querySelectorAll(".exLayer")) {
      const cs = getComputedStyle(e);
      layers[e.dataset.layer] = {
        /* karartma artık filter değil opacity (kompozitörde kalsın diye) */
        filter: e.style.filter,
        opacity: parseFloat(e.style.opacity || "1"),
        scale: parseFloat(e.style.transform?.match(/scale\(([\d.]+)\)/)?.[1] ?? "1"),
        ty: parseFloat(e.style.transform?.match(/translate3d\([^,]+,\s*([-\d.]+)px/)?.[1] ?? "0"),
        glow: parseFloat(e.style.getPropertyValue("--glow") || "0"),
        blend: cs.mixBlendMode,
      };
    }
    const focus = document.querySelector(".item.focus");
    return { exists: !!ex, opacity: parseFloat(ex?.style.opacity ?? "0"), layers, focusOpacity: parseFloat(focus?.style.opacity ?? "1") };
  });
};

const fresh = async (b, opts = {}) => {
  const p = await b.newPage({ viewport: { width: opts.w ?? 1440, height: opts.h ?? 860 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(700);
  return p;
};

const b = await chromium.launch();

// ---- 1) SMOOKY (dört katmanı tam): her claim'de doğru katman aktif
{
  const p = await fresh(b);
  for (const c of CLAIMS) {
    const s = await at(p, c.p);
    check(`${c.n}: patlamış burger görünür`, s.exists && s.opacity > 0.5, `opacity=${s.opacity}`);
    check(`${c.n}: odak fotoğrafı gizli`, s.focusOpacity < 0.05, `focus=${s.focusOpacity}`);
    for (const k of ALL) {
      const L = s.layers[k];
      if (c.active.includes(k)) {
        check(`${c.n}: ${k} aktif (tam opak + büyük + ışık)`, L.opacity === 1 && L.scale > 1.03 && L.glow > 0.3, `op=${L.opacity} sc=${L.scale} glow=${L.glow}`);
      } else {
        check(`${c.n}: ${k} karartılmış (opacity)`, L.opacity <= 0.55 && L.glow === 0, `op=${L.opacity} glow=${L.glow}`);
      }
    }
    /* aynı anda yalnızca beklenen katman(lar) aktif olmalı */
    const activeCount = ALL.filter((k) => s.layers[k].glow > 0.3).length;
    check(`${c.n}: yalnızca ${c.active.length} katman aktif`, activeCount === c.active.length, `aktif=${activeCount}`);
    /* saydam WebP: mix-blend-mode kullanılmamalı */
    check(`${c.n}: mix-blend-mode yok`, ALL.every((k) => s.layers[k].blend === "normal"));
    check(`${c.n}: hiçbir katmanda filter yok`, ALL.every((k) => !s.layers[k].filter || s.layers[k].filter === "none"), ALL.map((k) => s.layers[k].filter).join("|"));
    await p.screenshot({ path: `${out}/1440-${c.n}.png` });
  }

  // ---- 2) açılma/birleşme: c0 öncesi ve c3 sonrası katmanlar birleşik
  /* Açılma c0 (0.28) çevresinde ±0.035'lik bantta olur → "önce" örneği bandın dışından.
     Sahne yumuşatması (cur += (target-cur)*0.12) uzak sıçramalarda geç oturuyor:
     bu örnek için daha uzun bekle, yoksa katmanlar yolun ortasında yakalanıyor. */
  const before = await at(p, 0.22, 3000);
  const spreadBefore = Math.max(...ALL.map((k) => Math.abs(before.layers[k].ty)));
  check("c0 öncesi katmanlar birleşik", spreadBefore < 6, `maxTy=${spreadBefore.toFixed(1)}px`);
  const open = await at(p, 0.45);
  const spreadOpen = Math.max(...ALL.map((k) => Math.abs(open.layers[k].ty)));
  /* açıklık yığın yüksekliğinin %38'i; en dış katmanın kayması ~yarısı kadar */
  check("iddialarda ayrılmış", spreadOpen > 25, `maxTy=${spreadOpen.toFixed(1)}px`);
  const after = await at(p, 0.68, 3000);
  const spreadAfter = Math.max(...ALL.map((k) => Math.abs(after.layers[k].ty)));
  check("manifestoya geçerken birleşir", spreadAfter < 6, `maxTy=${spreadAfter.toFixed(1)}px`);
  check("manifestoda fotoğraf geri gelir", after.focusOpacity > 0.9, `focus=${after.focusOpacity}`);
  await p.close();
}

// ---- 3) mobil: aynı kurgu, ekrana sığar
{
  const p = await fresh(b, { w: 390, h: 844 });
  const s = await at(p, 0.42);
  check("mobil: ekmek çifti aktif", s.layers.ekmekUst.glow > 0.3 && s.layers.ekmekAlt.glow > 0.3);
  const box = await p.evaluate(() => {
    const r = [...document.querySelectorAll(".exLayer img")].map((i) => i.getBoundingClientRect());
    return { top: Math.min(...r.map((x) => x.top)), bottom: Math.max(...r.map((x) => x.bottom)), left: Math.min(...r.map((x) => x.left)), right: Math.max(...r.map((x) => x.right)), vw: innerWidth, vh: innerHeight };
  });
  check("mobil: yığın ekranda", box.top > -10 && box.bottom < box.vh + 10 && box.left > -10 && box.right < box.vw + 10, JSON.stringify({ t: box.top | 0, b: box.bottom | 0, l: box.left | 0, r: box.right | 0 }));
  await p.screenshot({ path: `${out}/390-ekmek.png` });
  await p.close();
}

// ---- 4) hasLayers=false ürün: fotoğraf kalır, patlamış burger yok
{
  const p = await fresh(b);
  /* Mag Berry'ye geç (yalnızca 1 katman dosyası var) */
  await p.click('button[aria-label="Sonraki ürün"]');
  await p.waitForTimeout(700);
  await p.click('button[aria-label="Sonraki ürün"]');
  await p.waitForTimeout(900);
  const title = await p.evaluate(() => document.querySelector(".scHero h1")?.textContent ?? "");
  const s = await at(p, 0.42);
  check("katmansız üründe fotoğraf kalır", s.focusOpacity > 0.9, `${title} focus=${s.focusOpacity}`);
  check("katmansız üründe patlamış burger çizilmez", !s.exists || s.opacity === 0, `exists=${s.exists} op=${s.opacity}`);
  await p.screenshot({ path: `${out}/1440-katmansiz.png` });
  await p.close();
}

// ---- 5) reduced-motion: hareket ve ses yok
{
  const p = await fresh(b, { reduced: true });
  const hasScene = await p.evaluate(() => Boolean(document.querySelector(".explode") || document.querySelector(".field")));
  check("reduced-motion: hareketli sahne çizilmez", !hasScene);
  await p.screenshot({ path: `${out}/1440-reduced.png` });
  await p.close();
}

await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
