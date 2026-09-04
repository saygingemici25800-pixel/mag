// Kapanış zinciri: BİZE KATIL → burger alttan yükselir → hero pozu → yanlar belirir → p=1 ≡ p=0.
// Bu bağlantı bir kez sessizce koptu (SSS panelinin çıkışı düşmüştü, panel burgerin üstünde
// opak kalıyordu); regresyon olarak sabitlendi.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

await p.goto(base + "/", { waitUntil: "load" });
await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(700);

const at = async (pr, settle = 1500) => {
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * m)); }, pr);
  await p.waitForTimeout(settle);
  return p.evaluate(() => {
    const f = document.querySelector(".item.focus");
    const tf = f?.style.transform ?? "";
    return {
      focusOp: parseFloat(f?.style.opacity ?? "0"),
      y: parseFloat(tf.match(/translate\([-\d.]+px,\s*([-\d.]+)px\)/)?.[1] ?? "0"),
      scale: parseFloat(tf.match(/scale\(([\d.]+)\)/)?.[1] ?? "0"),
      faqOp: parseFloat(document.querySelector(".scFaq")?.style.opacity ?? "0"),
      footOp: parseFloat(document.querySelector(".scFoot")?.style.opacity ?? "0"),
      explodeOp: parseFloat(document.querySelector(".explode")?.style.opacity ?? "0"),
      slots: [...document.querySelectorAll(".item")].map((e) => parseFloat(e.style.opacity || "0")),
      transform: tf,
    };
  });
};

/* İlk örnek uzak bir sıçrama sonrası geliyor; sahne yumuşatması (cur += (target-cur)*0.12)
   geç oturuyor, bu yüzden daha uzun bekle. */
const foot = await at(0.895, 3000);
check("BİZE KATIL'da burger aşağıda", foot.y > 400, `y=${foot.y}`);

// out1 ortası → burger yükseliyor, SSS paneli çekilmiş olmalı
const mid = await at(0.94);
check("out1'de burger yükseliyor", mid.y < foot.y - 100, `y=${foot.y} → ${mid.y}`);
check("out1'de burger görünür", mid.focusOp > 0.9, `opacity=${mid.focusOp}`);
/* Kritik: SSS paneli kapanışta çekilmezse yükselen burgerin üstünde opak kalıyor */
check("out1'de SSS paneli çekilmiş", mid.faqOp < 0.5, `faq=${mid.faqOp}`);
check("kapanışta katmanlar değil FOTOĞRAF", mid.explodeOp === 0, `explode=${mid.explodeOp}`);

// out1 sonu → hero pozuna oturmuş
const top = await at(0.957);
check("burger hero pozuna oturdu", Math.abs(top.scale - 1.14) < 0.06, `scale=${top.scale}`);

// out2 → yanlarda diğerleri belirir
const sides = await at(0.98);
const visible = sides.slots.filter((o) => o > 0.5).length;
check("out2'de yan burgerler belirdi", visible >= 3, `görünür slot=${visible}`);
check("out2'de SSS ve BİZE KATIL yok", sides.faqOp < 0.1 && sides.footOp < 0.1, `faq=${sides.faqOp} foot=${sides.footOp}`);

/* p=1 karesi: döngü `scrollY >= max-4` ile tetiklendiği için TAM dibe in */
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(1600);
const end = await p.evaluate(() => document.querySelector(".item.focus")?.style.transform ?? "");
/* loopBack: hero pozunda bir an durur (HOLD_MS), sonra scrollTo(0) */
await p.waitForTimeout(3000);
const looped = await p.evaluate(() => window.scrollY);
check("döngü başa sardı", looped < 40, `scrollY=${looped}`);
check("preloader tekrar oynamadı", (await p.$(".pre")) === null);
await p.waitForTimeout(1200);
const home = await p.evaluate(() => document.querySelector(".item.focus")?.style.transform ?? "");
check("p=1 karesi p=0 ile aynı", end === home, `\n    p=1: ${end}\n    p=0: ${home}`);

await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
