// Klavye ile tam sipariş akışı: yalnızca Tab / Shift+Tab / Enter / Space / ok tuşları / yazma.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.clock.install({ time: new Date("2026-09-03T12:00:00+03:00") }); // dükkân açık (sunucu: MAG_FAKE_NOW)
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
let fail = 0; const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const focused = () => page.evaluate(() => { const e = document.activeElement; return (e?.tagName || "") + (e?.textContent?.trim().slice(0, 30) ? ":" + e.textContent.trim().slice(0, 30) : "") + (e?.getAttribute("aria-label") ? "[" + e.getAttribute("aria-label") + "]" : ""); });
// Tab'la hedef bulan yardımcı (en fazla 80 adım)
async function tabTo(pred, max = 80) { for (let i = 0; i < max; i++) { await page.keyboard.press("Tab"); const f = await focused(); if (pred(f)) return f; } return null; }

await page.goto(base + "/siparis", { waitUntil: "load" }); await page.waitForTimeout(500);
// 1) Kurye segmentine Tab + Enter
check("Kurye butonuna klavyeyle ulaşıldı", (await tabTo((f) => f.startsWith("BUTTON:Kurye"))) !== null);
await page.keyboard.press("Enter");
// 2) Mahalle select: Tab + ok tuşu
const sel = await tabTo((f) => f.startsWith("SELECT"));
check("Mahalle seçicisine ulaşıldı", sel !== null);
await page.keyboard.type("Fet"); // harf yazarak seçim (Chromium ok tuşunda açılır liste bekler)
check("Mahalle klavyeyle seçildi", (await page.$eval("select[aria-label=Mahalle]", (e) => e.value)) !== "");
// 3) ⓘ butonu: Enter → modal, Escape kapatır
const ib = await tabTo((f) => f.includes("[Minimum sepet"));
check("ⓘ butonuna ulaşıldı", ib !== null);
await page.keyboard.press("Enter"); await page.waitForTimeout(200);
check("modal açıldı", (await page.$("[role=dialog]")) !== null);
await page.keyboard.press("Escape"); await page.waitForTimeout(200);
check("Escape modalı kapattı", (await page.$("[role=dialog]")) === null);
// 4) İlk "Ekle" (Smooky) → Enter, sonra "Artır" → Enter
check("Ekle butonuna ulaşıldı", (await tabTo((f) => f.startsWith("BUTTON:Ekle"))) !== null);
await page.keyboard.press("Enter"); await page.waitForTimeout(150);
// odak: Ekle kaybolur; adet grubuna geç
const inc = await tabTo((f) => f.includes("[Artır]"), 6);
check("Artır butonuna ulaşıldı", inc !== null);
await page.keyboard.press("Enter"); await page.waitForTimeout(150);
const qty = await page.$eval("article.card.on .qty b", (e) => e.textContent);
check("adet 2", qty === "2", "adet=" + qty);
// 5) Form alanları: Tab ile ulaşıp yaz
check("Ad soyad alanı", (await tabTo((f) => f.startsWith("INPUT") && f.includes(""), 120)) !== null);
// Ad soyad'a kadar tab'la (placeholder ile bul)
await page.evaluate(() => {}); 
const nameReached = await (async () => { for (let i = 0; i < 120; i++) { const ph = await page.evaluate(() => document.activeElement?.getAttribute("placeholder")); if (ph === "Ad soyad") return true; await page.keyboard.press("Tab"); } return false; })();
check("Ad soyad alanına Tab ile ulaşıldı", nameReached);
await page.keyboard.type("Klavye Test");
await page.keyboard.press("Tab"); await page.keyboard.type("05321112233");
await page.keyboard.press("Tab"); await page.keyboard.type("Karagözler Mah. Klavye Sk. No:1");
await page.keyboard.press("Tab"); // saat select — Şimdi kalsın
await page.keyboard.press("Tab"); await page.keyboard.type("klavye notu");
await page.keyboard.press("Tab"); // radio grubu
await page.keyboard.press("ArrowRight"); // Teslimatta kart
check("ödeme radyo ok tuşuyla değişti", (await page.$eval("input[name=payment]:checked", (e) => e.value)) === "card_on_delivery");
// 6) Onayla: Tab + Enter
const sub = await tabTo((f) => f.startsWith("BUTTON:Siparişi onayla"), 6);
check("Onayla butonuna ulaşıldı", sub !== null);
await page.keyboard.press("Enter");
await page.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(() => {});
check("sipariş klavyeyle tamamlandı", /\/siparis\/[0-9a-f-]{36}$/.test(page.url()), page.url());
// 7) Takip sayfasında odak sırası + odak görünürlüğü
await page.keyboard.press("Tab"); const f1 = await focused();
check("takip sayfasında ilk odak", f1.length > 0, f1);
console.log("errors:", errs.length ? errs : "none");
await browser.close(); process.exit(fail ? 1 : 0);
