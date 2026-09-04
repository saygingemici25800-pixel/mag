// Patlamış burger geometrisi: fotoğraf tamamen kalkmış mı, katmanlar tek eksende mi,
// ölçüler birbirini tutuyor mu, hiçbir katman ekrandan taşıyor mu?
// (Görünür sınır kutusu alfa ölçümlerinden hesaplanır — <img> kutusundan değil.)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapP } from "./_segments.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[4] ?? "/Users/saygin/Downloads/mag-starter";
const M = JSON.parse(readFileSync(path.join(root, "lib/katmanMetrics.json"), "utf8"));
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const b = await chromium.launch();
for (const [vw, vh] of [[1440, 860], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: vw, height: vh } });
  await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(700);
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(0.42, vw < 900));
  await p.waitForTimeout(1600);

  const r = await p.evaluate((M) => {
    const layers = [];
    for (const el of document.querySelectorAll(".exLayer")) {
      const img = el.querySelector("img");
      const key = img.currentSrc.split("/").pop().replace(/(@2x)?\.webp$/, "");
      const m = M[key];
      if (!m) continue;
      const bb = img.getBoundingClientRect();
      /* object-fit: contain, kare kaynak → görsel kutunun kısa kenarına sığar */
      const side = Math.min(bb.width, bb.height);
      const ox = bb.x + (bb.width - side) / 2, oy = bb.y + (bb.height - side) / 2;
      layers.push({ k: el.dataset.layer,
        left: ox + (m.cx - m.w / 2) * side, right: ox + (m.cx + m.w / 2) * side,
        top: oy + (m.cy - m.h / 2) * side, bottom: oy + (m.cy + m.h / 2) * side,
        w: m.w * side });
    }
    const f = document.querySelector(".item.focus");
    return { layers, photoHidden: !f || getComputedStyle(f).display === "none", vw: innerWidth, vh: innerHeight };
  }, M);

  const tag = `${vw}x${vh}`;
  check(`${tag} ürün fotoğrafı tamamen kaldırıldı (display:none)`, r.photoHidden);
  check(`${tag} beş katman var`, r.layers.length === 5, `${r.layers.length}`);

  /* tek dikey eksen: görünür merkezler aynı x'te */
  const cxs = r.layers.map((l) => (l.left + l.right) / 2);
  check(`${tag} katmanlar tek eksende`, Math.max(...cxs) - Math.min(...cxs) <= 2, `sapma=${(Math.max(...cxs) - Math.min(...cxs)).toFixed(1)}px`);

  /* ölçüler: ekmek en geniş, diğerleri ondan küçük ve makul aralıkta */
  const w = Object.fromEntries(r.layers.map((l) => [l.k, l.w]));
  const ref = Math.max(w.ekmekUst, w.ekmekAlt);
  check(`${tag} ekmek en geniş`, ref >= w.et && ref >= w.peynir && ref >= w.sos,
    `ekmek=${ref | 0} et=${w.et | 0} peynir=${w.peynir | 0} sos=${w.sos | 0}`);
  for (const [k, lo, hi] of [["et", 0.78, 0.98], ["peynir", 0.74, 0.95], ["sos", 0.66, 0.9]]) {
    const ratio = w[k] / ref;
    check(`${tag} ${k} oranı makul (${lo}–${hi})`, ratio >= lo && ratio <= hi, `oran=${ratio.toFixed(2)}`);
  }

  /* taşma yok: görünür kutunun tamamı viewport içinde */
  const L = Math.min(...r.layers.map((l) => l.left)), R = Math.max(...r.layers.map((l) => l.right));
  const T = Math.min(...r.layers.map((l) => l.top)), B = Math.max(...r.layers.map((l) => l.bottom));
  check(`${tag} yığın ekranda (kırpılma yok)`, L >= -2 && R <= r.vw + 2 && T >= -2 && B <= r.vh + 2,
    `x ${L | 0}→${R | 0} (vw ${r.vw}) · y ${T | 0}→${B | 0} (vh ${r.vh})`);
  /* yığın fotoğrafın durduğu yere oturur (takas kuralı); dikey konum fotoğraf pozundan gelir */
  console.log(`     (bilgi) ${tag} üst boşluk ${T | 0}px · alt boşluk ${(r.vh - B) | 0}px`);
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
