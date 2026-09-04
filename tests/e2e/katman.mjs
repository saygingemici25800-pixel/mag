// Katman aşamaları: Smooky ve Brisket'in 4 aşaması iki viewport'ta.
// Masaüstü: slot sol sütunda, açıklamanın 28px altında, başlıkla hizalı, 200px, 4 iddiada sabit.
// Mobil: sağda, ikon rayının solunda, 140px. İkisinde de radyal karartma + elips gölge.
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
const GAP = 28;
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const probe = () => {
  const s = document.querySelector(".stageSlot");
  if (!s) return null;
  const img = s.querySelector("img:not(.out)");
  const r = s.getBoundingClientRect();
  const left = document.querySelector(".scDive .left");
  const title = left?.querySelector(".big");
  const p = left?.querySelector("p");
  const rail = document.querySelector(".rail")?.getBoundingClientRect();
  const cs = getComputedStyle(s);
  return {
    src: img?.getAttribute("src"), complete: img?.complete, w: img?.naturalWidth,
    blend: cs.mixBlendMode,
    box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    titleLeft: title ? Math.round(title.getBoundingClientRect().left) : null,
    pBottom: p ? Math.round(p.getBoundingClientRect().bottom) : null,
    railLeft: rail ? Math.round(rail.left) : null,
    railMidY: rail ? Math.round(rail.top + rail.height / 2) : null,
    shadow: getComputedStyle(s, "::after").filter,
    scrim: getComputedStyle(s, "::before").backgroundImage,
  };
};

const b = await chromium.launch();
for (const v of VIEWS) {
  const desktop = v.width >= 900;
  const size = desktop ? 200 : 140;
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
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await p.evaluate((pr) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.round(pr * max));
      }, P[i]);
      await p.waitForTimeout(1500);
      const info = await p.evaluate(probe);
      const tag = `${prod}-${i + 1}-${KEYS[i]}`;
      check(`${v.name} ${tag} slot var`, !!info, "slot yok");
      if (info) {
        seen.push(info.box);
        check(`${v.name} ${tag} doğru görsel`, info.src === `/assets/katman/${tag}.webp`, info.src ?? "");
        check(`${v.name} ${tag} yüklendi`, info.complete && info.w > 0, `naturalWidth=${info.w}`);
        check(`${v.name} ${tag} karışım normal`, info.blend === "normal", info.blend);
        check(`${v.name} ${tag} ${size}px kare`, info.box.w === size && info.box.h === size, `${info.box.w}x${info.box.h}`);
        check(`${v.name} ${tag} radyal karartma`, /radial-gradient/.test(info.scrim), info.scrim.slice(0, 40));
        check(`${v.name} ${tag} elips gölge`, info.shadow.includes("blur(18px)"), info.shadow);
        if (desktop) {
          check(`${v.name} ${tag} başlıkla hizalı`, Math.abs(info.box.x - info.titleLeft) <= 1, `slot=${info.box.x} başlık=${info.titleLeft}`);
          // slot en uzun iddiaya göre sabitli: bu iddianın paragrafından en az GAP kadar aşağıda
          check(`${v.name} ${tag} paragrafın altında (≥${GAP}px)`, info.box.y - info.pBottom >= GAP - 1, `boşluk=${info.box.y - info.pBottom}px`);
        } else {
          check(`${v.name} ${tag} rayın solunda`, info.box.x + info.box.w <= info.railLeft, `slotSag=${info.box.x + info.box.w} railSol=${info.railLeft}`);
          check(`${v.name} ${tag} rayla hizalı`, Math.abs(info.box.y + info.box.h / 2 - info.railMidY) <= 2, `slotMid=${info.box.y + info.box.h / 2} railMid=${info.railMidY}`);
        }
      }
      await p.screenshot({ path: `${out}/${v.name}-${tag}.png` });
    }
    // 4 iddiada da aynı yerde: metin uzunluğu değişse de kutu oynamamalı
    const jitterX = Math.max(...seen.map((s) => Math.abs(s.x - seen[0].x)));
    const jitterY = Math.max(...seen.map((s) => Math.abs(s.y - seen[0].y)));
    check(`${v.name} ${prod} slot 4 iddiada sabit`, jitterX === 0 && jitterY === 0, `Δx=${jitterX} Δy=${jitterY}`);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(900);
  }
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
