// Faz 5 — 390×844, mock ödeme ile tam akış + başarısız dal + panel (SSE) + ekran görüntüleri
import { chromium } from "playwright";
import { FAKE_NOW, PANEL_KEY as KEY, assertServerReady, clearCart, fillDelivery, waitForCartCount } from "./_cart-fixture.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? ".";
const FAKE = FAKE_NOW;
await assertServerReady(base);
const browser = await chromium.launch();
let fail = 0; const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const errs = [];

// panel
const pctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const panel = await pctx.newPage(); panel.on("pageerror", (e) => errs.push("panel: " + e.message));
await panel.clock.install({ time: FAKE });
await panel.goto(base + "/panel", { waitUntil: "load" });
await panel.fill("form input[type=password]", KEY); await panel.click("form button[type=submit]");
await panel.waitForSelector(".tabs", { timeout: 8000 });
await panel.click("[data-sound]"); await panel.waitForTimeout(300);
// ses çalma sayacı (Audio.play patch)
await panel.evaluate(() => { window.__plays = 0; const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays++; return p.call(this); }; });
const before = await panel.$$eval(".ocard", (e) => e.length);

// müşteri (390×844)
const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const c = await cctx.newPage(); c.on("pageerror", (e) => errs.push("cust: " + e.message));
await clearCart(c);
await c.clock.install({ time: FAKE });
await c.goto(base + "/siparis", { waitUntil: "load" }); await c.waitForTimeout(700);
await c.screenshot({ path: `${out}/f5-1-liste.png` });
check("kategori çipleri yapışkan", await c.$eval(".chipsbar", (e) => getComputedStyle(e).position) === "sticky");
// ürün kartına dokun → sheet
await c.locator("article.pcard", { hasText: "Smooky" }).first().click();
await c.waitForSelector(".sheet", { timeout: 4000 }); await c.waitForTimeout(500);
await c.screenshot({ path: `${out}/f5-2-sheet.png` });
// öneriden sos ekle
const chip = c.locator(".chip", { hasText: "Mag sos" }).first();
check("öneri çipleri var", (await c.$$eval(".chip", (e) => e.length)) >= 2);
await chip.click(); await c.waitForTimeout(200);
check("öneri sos sepete eklendi", (await chip.locator("b").innerText()) === "✓");
// adet 2 → sepete ekle
await c.locator(".sheet .qty button[aria-label=Artır]").click();
await c.locator(".sheet .submit").click();
await c.waitForSelector("[data-cartbar]", { timeout: 4000 });
/* çip + sheet eklemesi sıraya girer: veri start+0.6 s'de yazılır, uçuş ~1.9 s sürer */
await waitForCartCount(c, 3);
await c.screenshot({ path: `${out}/f5-3-cubuk.png` });
const badge = await c.$eval(".cb-badge", (e) => e.textContent);
check("sepet çubuğu göründü, rozet 3 (2 burger + 1 sos)", badge === "3", "rozet=" + badge);
// kaydır → çubuk sabit mi
await c.evaluate(() => window.scrollTo(0, 1600)); await c.waitForTimeout(500);
const rect = await c.$eval(".cartbarwrap", (e) => { const r = e.getBoundingClientRect(); return { bottom: Math.round(r.bottom), pos: getComputedStyle(e).position }; });
check("çubuk kaydırınca sabit (fixed, altta)", rect.pos === "fixed" && Math.abs(rect.bottom - 844) < 2, JSON.stringify(rect));
// karttaki + Ekle ile ayran ekle → rozet 4
await c.locator("article.pcard", { hasText: "Arslan ayran" }).locator("button.addbtn").click();
await waitForCartCount(c, 4);
check("+ Ekle ile rozet güncellendi", (await c.$eval(".cb-badge", (e) => e.textContent)) === "4");
// sepete git
await c.locator(".cartbar2").click();
await c.waitForURL(/\/siparis\/odeme/, { timeout: 8000 }); await c.waitForTimeout(600);
await c.screenshot({ path: `${out}/f5-4-odeme.png`, fullPage: true });
check("ödeme sayfasında 3 satır", (await c.locator(".line:visible").count()) === 3);
await fillDelivery(c, { address: "Karagözler Mah. Ödeme Sk. No:5", name: "Mobil Ödeme", phone: "0533 444 55 66" });
const t0 = Date.now();
await c.getByRole("button", { name: /Ödemeye geç/ }).click();
await c.waitForURL(/\/odeme\/test\?ref=/, { timeout: 15000 }); await c.waitForTimeout(500);
await c.screenshot({ path: `${out}/f5-5-test-odeme.png` });
check("mock ödeme sayfasına yönlendi", true);
// ödemeden önce panelde görünmemeli
await panel.waitForTimeout(800);
check("ödenmemiş sipariş panelde YOK", (await panel.$$eval(".ocard", (e) => e.length)) === before);
// başarısız dal
await c.locator("form:has(input[value=fail]) button").click();
await c.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 }); await c.waitForTimeout(600);
const idFail = c.url().split("/").pop();
check("başarısız → takipte 'Ödeme başarısız' + tekrar dene", (await c.getAttribute("[data-payment]", "data-payment")) === "payment_failed" && (await c.$(".addbtn")) !== null);
await c.screenshot({ path: `${out}/f5-6-basarisiz.png` });
// tekrar dene → mock → başarılı
await c.getByRole("button", { name: /tekrar dene/i }).click();
await c.waitForURL(/\/odeme\/test\?ref=/, { timeout: 15000 });
await c.locator("form:has(input[value=ok]) button").click();
await c.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 }); await c.waitForTimeout(600);
check("aynı sipariş ödendi", c.url().endsWith(idFail) && (await c.getAttribute("[data-payment]", "data-payment")) === "paid");
await c.screenshot({ path: `${out}/f5-7-odendi.png` });
// panelde kart + ses
await panel.waitForSelector(`.ocard[data-id="${idFail}"]`, { timeout: 5000 }).catch(() => {});
check("panelde paid kart geldi", (await panel.$(`.ocard[data-id="${idFail}"].unseen`)) !== null);
check("panelde ses çaldı", (await panel.evaluate(() => window.__plays)) >= 1, "plays=" + (await panel.evaluate(() => window.__plays)));
console.log("errors:", errs.length ? errs : "none", "| ms:", Date.now() - t0);
await browser.close(); process.exit(fail ? 1 : 0);
