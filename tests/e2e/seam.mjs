// p=0 ≡ p=1 kontrolü: diskler kaldırıldıktan sonra da kapanış dikişi görünmemeli
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(600);
const frameAt = async (pr) => {
  await p.evaluate((v) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, v >= 1 ? max - 5 : Math.round(v * max)); }, pr);
  await p.waitForTimeout(1800);
  return p.$$eval(".item", (els) => els.map((e) => e.style.transform + "|" + e.style.opacity + "|" + e.style.filter));
};
const f0 = await frameAt(0);
const f1 = await frameAt(1);
let same = 0, diff = [];
f0.forEach((v, i) => { if (v === f1[i]) same++; else diff.push(`slot${i}: ${v}  ≠  ${f1[i]}`); });
console.log(same === f0.length ? "PASS p=0 ≡ p=1 (tüm slotlar birebir)" : "FAIL fark var");
diff.slice(0, 3).forEach((d) => console.log("  " + d));
console.log("disk DOM'da mı:", await p.evaluate(() => !!document.querySelector(".disc, .discA, .discB")));
await b.close();
