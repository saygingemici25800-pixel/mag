// Katman aşamaları: Smooky ve Brisket'in 4 aşaması iki viewport'ta görünüyor mu?
// Slot şeffaf WebP (karışım normal), ikon rayının solunda, rayla hizalı.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/katman";
mkdirSync(out, { recursive: true });

const KEYS = ["et", "ekmek", "peynir", "sos"];
const P = [0.33, 0.42, 0.5, 0.58]; // c0..c3 ortaları
const VIEWS = [
  { name: "1440x860", width: 1440, height: 860 },
  { name: "390x844", width: 390, height: 844 },
];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const b = await chromium.launch();
for (const v of VIEWS) {
  const p = await b.newPage({ viewport: { width: v.width, height: v.height } });
  await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600);

  for (const prod of ["smooky", "brisket"]) {
    if (prod === "brisket") {
      await p.click('button[aria-label="Sonraki ürün"]');
      await p.waitForTimeout(700);
    }
    for (let i = 0; i < 4; i++) {
      await p.evaluate((pr) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.round(pr * max));
      }, P[i]);
      await p.waitForTimeout(1500);
      const info = await p.evaluate(() => {
        const s = document.querySelector(".stageSlot");
        if (!s) return null;
        const img = s.querySelector("img:not(.out)");
        const cs = getComputedStyle(s);
        const r = s.getBoundingClientRect();
        const rail = document.querySelector(".rail")?.getBoundingClientRect();
        return {
          src: img?.getAttribute("src"), complete: img?.complete, w: img?.naturalWidth,
          blend: cs.mixBlendMode, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          railLeft: rail ? Math.round(rail.left) : null, railMidY: rail ? Math.round(rail.top + rail.height / 2) : null,
          shadow: getComputedStyle(s, "::after").filter,
        };
      });
      const tag = `${prod}-${i + 1}-${KEYS[i]}`;
      check(`${v.name} ${tag} slot var`, !!info, "slot yok");
      if (info) {
        check(`${v.name} ${tag} doğru görsel`, info.src === `/assets/katman/${tag}.webp`, info.src ?? "");
        check(`${v.name} ${tag} yüklendi`, info.complete && info.w > 0, `naturalWidth=${info.w}`);
        check(`${v.name} ${tag} karışım normal`, info.blend === "normal", info.blend);
        const size = v.width < 900 ? 140 : 220;
        check(`${v.name} ${tag} ${size}px kare`, info.box.w === size && info.box.h === size, `${info.box.w}x${info.box.h}`);
        check(`${v.name} ${tag} rayın solunda`, info.box.x + info.box.w <= info.railLeft, `slotSag=${info.box.x + info.box.w} railSol=${info.railLeft}`);
        check(`${v.name} ${tag} rayla hizalı`, Math.abs(info.box.y + info.box.h / 2 - info.railMidY) <= 2, `slotMid=${info.box.y + info.box.h / 2} railMid=${info.railMidY}`);
        check(`${v.name} ${tag} elips gölge`, info.shadow.includes("blur(18px)"), info.shadow);
      }
      await p.screenshot({ path: `${out}/${v.name}-${tag}.png` });
    }
    // sonraki ürüne geçmeden hero'ya dön
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(900);
  }
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
