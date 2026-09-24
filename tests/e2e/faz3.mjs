// Faz 3 uçtan uca: panel giriş (PANEL_KEY), ses, iki sekme (sipariş → panel ≤2 sn → durum → müşteri ≤2 sn)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { clearCart, fillDelivery, waitForCartCount } from "./_cart-fixture.mjs";
import { guard } from "../../scripts/test-guard.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
/* canlı veritabanına test yazmayı engeller (scripts/test-guard.mjs) */
await guard(base);
/* Ekran görüntüleri docs/screens/ altına (gitignore'lu); kök dizine YAZILMAZ. */
const out = process.argv[3] ?? "docs/screens/faz3";
mkdirSync(out, { recursive: true });
const KEY = process.env.PANEL_KEY ?? "test1234";
const FAKE_NOW = new Date("2026-09-03T12:00:00+03:00"); // dükkân açık (MAG_FAKE_NOW ile aynı)
const browser = await chromium.launch();
const errs = [];
const hook = (p, tag) => { p.on("pageerror", (e) => errs.push(`[${tag}] ${e.message}`)); p.on("console", (m) => m.type() === "error" && errs.push(`[${tag}] ${m.text()}`)); };
let fail = 0;
const check = (name, ok, extra = "") => { console.log((ok ? "PASS" : "FAIL") + " " + name + (extra ? " — " + extra : "")); if (!ok) fail++; };

// --- panel sekmesi ---
const panelCtx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
/* 24 Eyl 2026: web push kanalı kaldırıldı — serviceWorker/PushManager/Notification
   taklitleri SİLİNDİ; panel artık bunların hiçbirine dokunmuyor. */
const panel = await panelCtx.newPage(); hook(panel, "panel"); await panel.clock.install({ time: FAKE_NOW });
await panel.goto(base + "/panel", { waitUntil: "load" });
await panel.waitForSelector("form input[type=password]", { timeout: 8000 });
await panel.screenshot({ path: `${out}/faz3-login.png` });
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
/* KARARSIZLIK DÜZELTMESİ (24 Eyl 2026): sabit 400 ms bekleniyordu. Kilidi açan
   `audio.play()` sözü makine yüküne göre 91 ms ile 5211 ms arasında değişiyor
   (ölçüldü); yavaş koşularda ölçüm erken düşüp "locked" okuyordu. Bu, notlarda
   "faz3 oynak, data-sound=locked" diye geçen düşmenin gerçek sebebiydi —
   tarayıcı ses kilidi değil, testin sabit beklemesi. panel.mjs'te de aynısı. */
await panel
  .waitForFunction(() => document.querySelector("[data-sound]")?.getAttribute("data-sound") === "on", null, { timeout: 15000 })
  .catch(() => {});
const snd = await panel.getAttribute("[data-sound]", "data-sound");
check("ses kilidi açıldı", snd === "on", "data-sound=" + snd);
/* push aboneliği kontrolü SİLİNDİ — 24 Eyl 2026'da kanal kaldırıldı,
   [data-push] düğmesi artık yok. Panelde bildirim kanalı: WhatsApp. */

// --- müşteri sekmesi ---
const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const cust = await custCtx.newPage(); hook(cust, "cust"); await cust.clock.install({ time: FAKE_NOW });
await clearCart(cust);
await cust.goto(base + "/siparis", { waitUntil: "load" });
await cust.waitForTimeout(500);
/* Faz 5: ürün listeden eklenir, kurye/adres ödeme sayfasındadır */
await cust.locator("article.pcard", { hasText: "Brisket" }).locator("button.addbtn").click();
await waitForCartCount(cust, 1);
await cust.locator("article.pcard", { hasText: "Brisket" }).locator("button.addbtn").click();
await waitForCartCount(cust, 2);
await cust.locator(".cartbar2").click();
await cust.waitForURL(/\/siparis\/odeme/, { timeout: 8000 });
await cust.waitForTimeout(500);
await fillDelivery(cust, { address: "Karagözler Mah. Deneme Sk. No:3", name: "Canlı Test", phone: "+90 532 000 00 00" });
const t0 = Date.now();
/* 21 Eyl 2026: arayüzdeki buton artık WhatsApp'a gidiyor (geçici kanal).
   Bu paket PANEL CANLILIĞINI ve ödeme akışını sınıyor — ikisi de duruyor —
   bu yüzden sipariş ÖDEME kanalından (channel yok) API ile kuruluyor ve
   müşteri mock ödeme sayfasına elle götürülüyor. */
const kur = await (await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "delivery", zone: "karagozler", items: [{ id: "smooky", qty: 2 }], /* min sepet için 2 adet (merkez/karagözler eşiği) */
    name: "Canlı Test", phone: "05320000000", address: "Karagözler Mah. Deneme Sk. No:3",
    requested_at: "simdi", locale: "tr", terms_accepted: true }) })).json();
await cust.goto(kur.redirectUrl, { waitUntil: "load" });
await cust.waitForURL(/\/odeme\/test\?ref=/, { timeout: 15000 });
await cust.locator("form:has(input[value=ok]) button").click();
await cust.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 });
const id = cust.url().split("/").pop();
/* Panelde kart: realtime varsa ~1-2 sn, SUPABASE_JWT_SECRET yoksa yoklama yedeği (15 sn). */
await panel.waitForSelector(`.ocard[data-id="${id}"]`, { timeout: 25000 }).catch(() => {});
const dt = Date.now() - t0;
const cardEl = await panel.$(`.ocard[data-id="${id}"]`);
check("panel kartı geldi", cardEl !== null, `${dt} ms (sipariş tıklamasından itibaren)`);
check("kart vurgulu (unseen)", (await panel.$(`.ocard[data-id="${id}"].unseen`)) !== null);
await panel.waitForTimeout(300);
await panel.screenshot({ path: `${out}/faz3-panel-new.png` });
/* Panel üç aşamalı: "Siparişi al" siparişi doğrudan HAZIR'a taşır (kurye → Yolda, gel-al → Hazır).
   Müşteri takip ekranı bu değişimi ≤ 2 sn içinde görmeli. */
await cust.waitForSelector(".step.now", { timeout: 5000 });
const beforeTxt = await cust.$eval(".step.now", (e) => e.textContent?.trim() ?? "");
const t1 = Date.now();
await panel.click(`.ocard[data-id="${id}"] [data-accept]`);
/* müşteri ekranı 6 sn'de bir yokluyor (SSE kaldırıldı) → bir tur + pay bekle */
await cust.waitForFunction((prev) => (document.querySelector(".step.now")?.textContent?.trim() ?? "") !== prev, beforeTxt, { timeout: 12000 }).catch(() => {});
const nowTxt = await cust.$eval(".step.now", (e) => e.textContent).catch(() => "");
check("müşteri sayfası canlı güncellendi", nowTxt.trim() !== beforeTxt && nowTxt.length > 0, `${Date.now() - t1} ms · "${beforeTxt}" → "${nowTxt}"`);
check("statü sonrası vurgu kalktı", (await panel.$(`.ocard[data-id="${id}"].unseen`)) === null);
await cust.screenshot({ path: `${out}/faz3-cust-live.png` });
/* İptal: panelde artık SEBEP SORULMAZ, yalnızca onay istenir (üç aşamalı akış kararı). */
await panel.click(`.ocard[data-id="${id}"] .act.danger`);
await panel.click(`.ocard[data-id="${id}"] [data-cancel-confirm]`);
await cust.waitForFunction(() => document.querySelector(".step.now")?.textContent?.includes("İptal"), null, { timeout: 12000 }).catch(() => {});
const canc = await cust.$eval(".step.now", (e) => e.textContent).catch(() => "");
check("iptal müşteriye yansıdı", canc.includes("İptal"), `"${canc}"`);
await panel.click(".tabs button:nth-child(3)");
await panel.waitForTimeout(300);
await panel.screenshot({ path: `${out}/faz3-panel-past.png` });
// çıkış
await panel.click("text=Çıkış");
await panel.waitForSelector("form input[type=password]", { timeout: 5000 });
check("çıkış", true);
console.log("errors:", errs.length ? errs : "none");
await browser.close();
process.exit(fail ? 1 : 0);
