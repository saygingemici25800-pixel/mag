// Fonksiyonel kontroller: atEnd döngüsü, ok/klavye ile ürün değişimi, p=0 ≡ p=1 karesi, konsol hataları
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:3111/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(2600);

const title = async () => page.$eval("h1.big", (el) => el.textContent.trim());
console.log("hero title:", await title());

// ok → sonraki ürün
await page.click("button.arrow.r");
await page.waitForTimeout(700);
console.log("after next arrow:", await title());
// klavye ← → geri
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(700);
console.log("after ArrowLeft:", await title());
// slot içerikleri benzersiz mi?
const ks = await page.$$eval(".item", (els) => els.map((e) => e.dataset.k));
console.log("slots:", ks.join(","), "unique:", new Set(ks).size === ks.length);
// ok konumu ve görünürlüğü
const arrows = await page.$$eval("button.arrow", (els) =>
  els.map((e) => ({ left: e.style.left, top: e.style.top, opacity: e.style.opacity, pe: e.style.pointerEvents })),
);
console.log("arrows:", JSON.stringify(arrows));

// p=0 ve p≈1 karesi: odaktaki item transform'u aynı mı?
const tf = async () => page.$eval(".item:nth-child(3)", (e) => e.style.transform + " | " + e.style.filter + " | " + e.style.opacity);
const t0 = await tf();
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight - 5));
await page.waitForTimeout(1800);
const t1 = await tf();
console.log("p=0 :", t0);
console.log("p≈1 :", t1);

// atEnd → loopBack: sona kaydır, scrollY 0'a dönmeli, preloader tekrar oynamamalı
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(2500);
const y = await page.evaluate(() => window.scrollY);
const preGone = await page.$eval(".pre", (e) => e.classList.contains("gone"));
console.log("after end: scrollY =", y, "| preloader gone =", preGone);

// light mode sınıfı pay bölümünde
await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.68));
await page.waitForTimeout(1800);
console.log("html.lm at p=.68:", await page.evaluate(() => document.documentElement.classList.contains("lm")));
console.log("--accent:", await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent")));

console.log("errors:", errors.length ? errors : "none");
await browser.close();
