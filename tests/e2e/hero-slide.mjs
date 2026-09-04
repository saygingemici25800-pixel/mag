// Ok geçişi tek hareket mi? Ürünü kimliğiyle izle: x ve scale sürekli olmalı, slot kaydırmada kare farkı sıfır.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForTimeout(3200);
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const tr = await p.$$eval(".item", (els) => els.map((e) => getComputedStyle(e).transitionProperty + ":" + getComputedStyle(e).transitionDuration));
check(".item üzerinde transform/filter transition yok", tr.every((t) => t.startsWith("none") || t.endsWith("0s")), tr[0]);

// ürün kimliği → kare kare {x, scale}
const frames = await p.evaluate(() => new Promise((done) => {
  const rows = [];
  const grab = () => Object.fromEntries([...document.querySelectorAll(".item")].map((e) => {
    const m = e.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/);
    return [e.dataset.k, m ? { x: +m[1], s: +m[3] } : null];
  }));
  document.querySelector("button.arrow.r").click();
  requestAnimationFrame(() => {
    const t0 = performance.now();
    const step = () => { rows.push(grab()); if (performance.now() - t0 < 900) requestAnimationFrame(step); else done(rows); };
    step();
  });
}));

// yeni odak (brisket) ve eski odak (smooky) sürekliliği
for (const id of ["brisket", "smooky"]) {
  const seq = frames.map((f) => f[id]).filter(Boolean);
  const maxDx = Math.max(...seq.slice(1).map((v, i) => Math.abs(v.x - seq[i].x)));
  const maxDs = Math.max(...seq.slice(1).map((v, i) => Math.abs(v.s - seq[i].s)));
  check(`${id}: kare farkı sürekli (sıçrama yok)`, maxDx < 80 && maxDs < 0.08, `maxΔx=${maxDx.toFixed(1)}px maxΔscale=${maxDs.toFixed(3)}`);
}
// yeni odak ölçeği tek yönlü büyür
const bs = frames.map((f) => f.brisket?.s).filter(Boolean);
const back = bs.filter((v, i) => i > 0 && v < bs[i - 1] - 0.002).length;
check("yeni odak ölçeği tek yönlü büyür", back === 0, `${bs[0].toFixed(3)} → ${bs[bs.length - 1].toFixed(3)}, geri dönüş ${back}`);
// bitişte doğru poz
const last = frames[frames.length - 1];
// x tam 0 değil: görsel ağırlık merkezi düzeltmesi (lib/cutCenters.json) birkaç px kaydırır
check("bitişte odak ortada, scale=1.14", Math.abs(last.brisket.x) < 12 && Math.abs(last.brisket.s - 1.14) < 0.005, JSON.stringify(last.brisket));
await b.close();
process.exit(fail ? 1 : 0);
