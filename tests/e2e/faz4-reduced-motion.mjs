// prefers-reduced-motion: ana sayfa statik fallback gerçekten mi geliyor? Ekran görüntüsü + DOM kontrolü
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 860, "d"], [390, 844, "m"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load" }); await page.waitForTimeout(1200);
  await page.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  const info = await page.evaluate(() => ({ stage: !!document.querySelector(".stage"), scroller: !!document.querySelector(".scroller"), cards: document.querySelectorAll("main article").length, h: document.documentElement.scrollHeight, canvas: !!document.querySelector("canvas") }));
  console.log(`[${tag}] reduced-motion:`, JSON.stringify(info), info.stage || info.canvas || info.cards < 5 ? "FAIL" : "PASS");
  await page.screenshot({ path: `${out}/faz4-reduced-${tag}.png`, fullPage: tag === "m" ? false : true });
  await ctx.close();
}
await browser.close();
