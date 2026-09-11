// Ok geçişi tek hareket mi? Ürünü kimliğiyle izle: x ve scale sürekli olmalı, slot kaydırmada kare farkı sıfır.
// Kart transform'u (hero referansı): translate(calc(-50% + Xpx),Ypx) rotate(θ) scale(s); hero'da odak s=1, x=0.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await p.goto(base + "/", { waitUntil: "load" });
/* preloader en az 2.4 s + 1.07 s sürer: sabit bekleme yerine kalkışını bekle */
await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(600);
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const tr = await p.$$eval(".item", (els) => els.map((e) => getComputedStyle(e).transitionProperty + ":" + getComputedStyle(e).transitionDuration));
check(".item üzerinde transform/filter transition yok", tr.every((t) => t.startsWith("none") || t.endsWith("0s")), tr[0]);

// ürün kimliği → kare kare {x, scale}
const frames = await p.evaluate(() => new Promise((done) => {
  const rows = [];
  /* Kare zamanını da kaydet: yüklü makinede rAF aralığı 50 ms'ye çıkabiliyor ve tek karede
     alınan yol büyüyor. Süreklilik ölçüsü piksel/kare değil, piksel/ms olmalı. */
  const grab = () => Object.fromEntries([["__t", performance.now()], ...[...document.querySelectorAll(".item")].map((e) => {
    const m = e.style.transform.match(/translate\(calc\(-50% \+ (-?[\d.]+)px\),\s*(-?[\d.]+)px\) rotate\([-\d.]+deg\) scale\(([\d.]+)\)/);
    return [e.dataset.k, m ? { x: +m[1], s: +m[3] } : null];
  })]);
  /* eski 56 px daire buton kaldırıldı; yönlendirme artık .hnav chevron grubu */
  document.querySelector("button.hnav.r").click();
  requestAnimationFrame(() => {
    const t0 = performance.now();
    const step = () => { rows.push(grab()); if (performance.now() - t0 < 900) requestAnimationFrame(step); else done(rows); };
    step();
  });
}));

// yeni odak (truffle) ve eski odak (smooky) sürekliliği
// 11 Eyl 2026: hero sırasında ikinci ürünün id'si brisket → truffle oldu
for (const id of ["truffle", "smooky"]) {
  const rows = frames.filter((f) => f[id]);
  const seq = rows.map((f) => f[id]);
  /* Hız (px/ms) üzerinden bak: 480 ms'de ~403 px yol var, ease başta hızlı → ~4 px/ms tepe.
     Gerçek pencerede tek kare adımı 58 px; headless'ta kare düşünce 200 px'i geçebiliyor. */
  let maxRate = 0, maxDsRate = 0;
  for (let i = 1; i < seq.length; i++) {
    const dt = Math.max(1, rows[i].__t - rows[i - 1].__t);
    maxRate = Math.max(maxRate, Math.abs(seq[i].x - seq[i - 1].x) / dt);
    maxDsRate = Math.max(maxDsRate, Math.abs(seq[i].s - seq[i - 1].s) / dt);
  }
  check(`${id}: hareket sürekli (hız sınırlı)`, maxRate < 6 && maxDsRate < 0.006, `maxHız=${maxRate.toFixed(2)}px/ms maxÖlçekHızı=${maxDsRate.toFixed(4)}/ms`);
}
// yeni odak ölçeği tek yönlü büyür
const bs = frames.map((f) => f.truffle?.s).filter(Boolean);
const back = bs.filter((v, i) => i > 0 && v < bs[i - 1] - 0.002).length;
check("yeni odak ölçeği tek yönlü büyür", back === 0, `${bs[0].toFixed(3)} → ${bs[bs.length - 1].toFixed(3)}, geri dönüş ${back}`);
// bitişte doğru poz
const last = frames[frames.length - 1];
// hero'da ağırlık merkezi düzeltmesi yok (referans carousel birebir): x = 0, odak ölçeği 1
check("bitişte odak ortada (x=0), scale=1 (referans)", Math.abs(last.truffle.x) < 1 && Math.abs(last.truffle.s - 1) < 0.005, JSON.stringify(last.truffle));
await b.close();
process.exit(fail ? 1 : 0);
