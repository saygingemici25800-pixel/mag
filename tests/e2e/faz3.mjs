// Faz 3 uçtan uca: panel giriş (PANEL_KEY), ses/push mock, iki sekme (sipariş → panel ≤2 sn → durum → müşteri ≤2 sn)
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const KEY = process.env.PANEL_KEY ?? "test1234";
const browser = await chromium.launch();
const errs = [];
const hook = (p, tag) => { p.on("pageerror", (e) => errs.push(`[${tag}] ${e.message}`)); p.on("console", (m) => m.type() === "error" && errs.push(`[${tag}] ${m.text()}`)); };
let fail = 0;
const check = (name, ok, extra = "") => { console.log((ok ? "PASS" : "FAIL") + " " + name + (extra ? " — " + extra : "")); if (!ok) fail++; };

// --- panel sekmesi ---
const panelCtx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
await panelCtx.addInitScript(() => {
  // Push mock: sw kaydı + abonelik + izin
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: async () => ({ pushManager: { getSubscription: async () => null, subscribe: async () => ({ toJSON: () => ({ endpoint: "https://example.invalid/push/test-" + Date.now(), keys: { p256dh: "BPxTest", auth: "authTest" } }) }) } }) } });
  window.PushManager = function () {};
  window.Notification = { permission: "granted", requestPermission: async () => "granted" };
});
const panel = await panelCtx.newPage(); hook(panel, "panel");
await panel.goto(base + "/panel", { waitUntil: "load" });
await panel.waitForSelector("form input[type=password]", { timeout: 8000 });
await panel.screenshot({ path: "faz3-login.png" });
await panel.fill("form input[type=password]", "yanlis");
await panel.click("form button[type=submit]");
await panel.waitForSelector(".err", { timeout: 5000 });
check("yanlış şifre reddedildi", true);
await panel.fill("form input[type=password]", KEY);
await panel.click("form button[type=submit]");
await panel.waitForSelector(".tabs", { timeout: 8000 });
check("PANEL_KEY ile giriş", true);
await panel.waitForSelector("[data-live='true']", { timeout: 5000 }).catch(() => {});
check("canlı bağlantı (SSE)", await panel.$("[data-live='true']") !== null);
// çerez kalıcı mı: yeniden yükle
await panel.reload({ waitUntil: "load" });
await panel.waitForSelector(".tabs", { timeout: 8000 });
check("çerez ile oturum kalıcı", true);
// ses
await panel.click("[data-sound]");
await panel.waitForTimeout(400);
const snd = await panel.getAttribute("[data-sound]", "data-sound");
check("ses kilidi açıldı", snd === "on", "data-sound=" + snd);
// push
await panel.click("[data-push]");
await panel.waitForFunction(() => document.querySelector("[data-push]")?.getAttribute("data-push") !== "busy", null, { timeout: 8000 });
const push = await panel.getAttribute("[data-push]", "data-push");
check("push abonelik (mock) kaydedildi", push === "ok", "data-push=" + push);

// --- müşteri sekmesi ---
const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const cust = await custCtx.newPage(); hook(cust, "cust");
await cust.goto(base + "/siparis", { waitUntil: "load" });
await cust.waitForTimeout(500);
await cust.getByRole("button", { name: "Kurye" }).click();
await cust.selectOption("select[aria-label=Mahalle]", "merkez");
const card = cust.locator("article.card", { hasText: "Brisket" }).first();
await card.getByRole("button", { name: "Ekle" }).click();
await card.getByRole("button", { name: "Artır" }).click();
await cust.getByRole("button", { name: "Sepeti aç" }).click();
await cust.waitForTimeout(500);
await cust.fill("input[placeholder='Ad soyad']", "Canlı Test");
await cust.fill("input[placeholder='05XX XXX XX XX']", "+90 532 000 00 00");
await cust.fill("textarea", "Karagözler Mah. Deneme Sk. No:3");
const t0 = Date.now();
await cust.getByRole("button", { name: "Siparişi onayla" }).click();
await cust.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 });
const id = cust.url().split("/").pop();
// panelde kart ≤ 2 sn
await panel.waitForSelector(`.ocard[data-id="${id}"]`, { timeout: 4000 }).catch(() => {});
const dt = Date.now() - t0;
const cardEl = await panel.$(`.ocard[data-id="${id}"]`);
check("panel kartı geldi", cardEl !== null, `${dt} ms (sipariş tıklamasından itibaren)`);
check("kart vurgulu (unseen)", (await panel.$(`.ocard[data-id="${id}"].unseen`)) !== null);
await panel.waitForTimeout(300);
await panel.screenshot({ path: "faz3-panel-new.png" });
// panelde Hazırlanıyor → müşteri ≤ 2 sn
await cust.waitForSelector(".step.now", { timeout: 5000 });
const t1 = Date.now();
await panel.click(`.ocard[data-id="${id}"] .act.primary`);
await cust.waitForFunction(() => document.querySelector(".step.now")?.textContent?.includes("Hazırlanıyor"), null, { timeout: 4000 }).catch(() => {});
const nowTxt = await cust.$eval(".step.now", (e) => e.textContent).catch(() => "");
check("müşteri sayfası canlı güncellendi", nowTxt.includes("Hazırlanıyor"), `${Date.now() - t1} ms · "${nowTxt}"`);
check("statü sonrası vurgu kalktı", (await panel.$(`.ocard[data-id="${id}"].unseen`)) === null);
await cust.screenshot({ path: "faz3-cust-live.png" });
// iptal + sebep
await panel.click(`.ocard[data-id="${id}"] .act.danger`);
await panel.fill(`.ocard[data-id="${id}"] .cancelbox input`, "Müşteri aradı");
await panel.click(`.ocard[data-id="${id}"] .cancelbox .act.danger`);
await cust.waitForFunction(() => document.querySelector(".step.now")?.textContent?.includes("İptal"), null, { timeout: 4000 }).catch(() => {});
const canc = await cust.$eval(".step.now", (e) => e.textContent).catch(() => "");
check("iptal + sebep müşteride", canc.includes("Müşteri aradı"), `"${canc}"`);
await panel.click(".tabs button:nth-child(3)");
await panel.waitForTimeout(300);
await panel.screenshot({ path: "faz3-panel-past.png" });
// çıkış
await panel.click("text=Çıkış");
await panel.waitForSelector("form input[type=password]", { timeout: 5000 });
check("çıkış", true);
console.log("errors:", errs.length ? errs : "none");
await browser.close();
process.exit(fail ? 1 : 0);
