// Panel — uçtan uca: gerçek sipariş (mock ödeme) → panelde 2 sn içinde görünme → ses → üç aşama
//  → "sipariş kapalı" anahtarı siteyi kapatıyor mu → "tükendi" menüyü etkiliyor mu → gün sonu özeti.
// Yetki: şifresiz erişim yok, API uçları da korunuyor.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { seedCart, fillDelivery, FAKE_NOW } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/panel";
const KEY = process.env.PANEL_KEY ?? "test1234";
mkdirSync(out, { recursive: true });
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

const b = await chromium.launch();

/* ---------- 1) yetki: şifresiz erişim yok ---------- */
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(base + "/panel", { waitUntil: "load" });
  await p.waitForSelector("form input[type=password]", { timeout: 8000 });
  check("şifresiz panelde giriş formu var (liste yok)", (await p.$(".feed")) === null);
  /* API uçları da korunmalı */
  for (const [url, init] of [
    ["/api/orders?limit=5", {}],
    ["/api/panel/settings", { method: "PATCH", headers: { "content-type": "application/json" }, data: { ordering_open: false } }],
    ["/api/panel/summary", {}],
  ]) {
    const r = await ctx.request.fetch(base + url, init);
    check(`şifresiz ${init.method ?? "GET"} ${url} → 401`, r.status() === 401, String(r.status()));
  }
  /* yanlış şifre */
  await p.fill("form input[type=password]", "yanlis");
  await p.click("form button[type=submit]");
  await p.waitForSelector(".err", { timeout: 5000 });
  check("yanlış şifre reddedildi", true);
  await ctx.close();
}

/* ---------- panel oturumu ---------- */
const panelCtx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await panelCtx.addInitScript(() => {
  localStorage.setItem("mag:panel-sound", "1");
  /* ses çalma girişimlerini say (autoplay kilidi testte açılamaz) */
  window.__sounds = 0;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__sounds++;
    return play.apply(this, arguments).catch(() => {});
  };
});
const panel = await panelCtx.newPage();
await panel.clock.install({ time: FAKE_NOW });
await panel.goto(base + "/panel", { waitUntil: "load" });
await panel.fill("form input[type=password]", KEY);
await panel.click("form button[type=submit]");
await panel.waitForSelector(".tabs", { timeout: 8000 });
check("PANEL_KEY ile giriş", true);
/* çerez kalıcı: yeniden yükle */
await panel.reload({ waitUntil: "load" });
await panel.waitForSelector(".tabs", { timeout: 8000 });
check("httpOnly çerez ile oturum kalıcı", true);
/* Canlı akış bağlanana kadar bekle: realtime'da WebSocket el sıkışması ~1 sn sürer ve bu sırada
   gösterge "Bağlantı yok" der. Abonelik kurulmadan sipariş verilirse yeni kayıt kaçar. */
await panel.waitForFunction(() => document.querySelector("[data-feed]")?.dataset.live === "true", null, { timeout: 20000 }).catch(() => {});
const feedEl = await panel.evaluate(() => { const el = document.querySelector("[data-feed]"); return { text: el?.textContent?.trim(), live: el?.dataset.live, feed: el?.dataset.feed }; });
check("canlı akış bağlandı (realtime | sse | poll)", feedEl.live === "true" && ["realtime", "sse", "poll"].includes(feedEl.feed ?? ""), `${feedEl.feed} · ${feedEl.text}`);
/* ses: tarayıcı autoplay'i engeller → panel "sesi etkinleştir" gösterir; kullanıcı dokununca açılır */
check("ses aç/kapa anahtarı var", (await panel.$("[data-sound]")) !== null, await panel.getAttribute("[data-sound]", "data-sound"));
check("autoplay engelliyken 'sesi etkinleştir' gösteriliyor", (await panel.getAttribute("[data-sound]", "data-sound")) === "locked");
await panel.click("[data-sound]"); // kullanıcı dokunuşu → kilidi aç
await panel.waitForTimeout(400);
check("dokunuşla ses açıldı", (await panel.getAttribute("[data-sound]", "data-sound")) === "on", await panel.getAttribute("[data-sound]", "data-sound"));

/* ---------- 2) siteden gerçek sipariş → panelde 2 sn ---------- */
const shopCtx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await seedCart(shopCtx, { smooky: 1, brisket: 1, ayran: 1 }); // kurye min. sepet 800 ₺
const shop = await shopCtx.newPage();
await shop.clock.install({ time: FAKE_NOW });
await shop.goto(base + "/siparis/odeme", { waitUntil: "load" });
await shop.waitForTimeout(800);
await fillDelivery(shop, { zone: "merkez", address: "Panel testi Sk. No:1", name: "Panel Test", phone: "05321234567" });
const soundsBefore = await panel.evaluate(() => window.__sounds ?? 0);
const t0 = Date.now();
await shop.click('button[type="submit"]');
/* mock ödeme sayfası → ödemeyi onayla */
await shop.waitForURL(/\/odeme\/test/, { timeout: 15000 });
/* mock sağlayıcı sayfası: "Ödemeyi tamamla" → callback → /siparis/<id> */
await shop.getByRole("button", { name: "Ödemeyi tamamla" }).click();
await shop.waitForURL(/\/siparis\/[0-9a-f-]{36}/, { timeout: 20000 });
const orderId = shop.url().split("/siparis/")[1]?.split("?")[0] ?? "";
check("sipariş oluştu (mock ödeme)", /^[0-9a-f-]{36}$/.test(orderId), orderId);

/* panelde görünme süresi */
await panel.waitForSelector(`.ocard[data-id="${orderId}"]`, { timeout: 8000 });
const appearMs = Date.now() - t0;
check("yeni sipariş panele ≤ 2 sn içinde düştü", appearMs <= 2000 + 1500, `${appearMs} ms (ödeme akışı dahil)`);
const soundsAfter = await panel.evaluate(() => window.__sounds ?? 0);
check("yeni siparişte ses çalma denendi", soundsAfter > soundsBefore, `${soundsBefore} → ${soundsAfter}`);

const card = panel.locator(`.ocard[data-id="${orderId}"]`);
/* kart içeriği */
const cardText = await card.textContent();
for (const [n, re] of [["müşteri adı", /Panel Test/], ["telefon", /0532/], ["teslimat türü", /Kurye|Gel-al/], ["adres", /Panel testi Sk/], ["ürün", /Smooky/], ["toplam", /₺/]])
  check(`kartta ${n} var`, re.test(cardText ?? ""), "");
check("telefona tıklanabilir (tel:)", (await card.locator('a[href^="tel:"]').count()) > 0);
await panel.screenshot({ path: `${out}/1440-yeni.png` });

/* ---------- 3) üç aşama ---------- */
check("YENİ kartında 'Siparişi al' ve süre girişi var", (await card.locator("[data-accept]").count()) === 1 && (await card.locator("[data-prep]").count()) === 1);
const prepDefault = await card.locator("[data-prep]").inputValue();
check("hazırlanma süresi varsayılanı 30", prepDefault === "30", prepDefault);
await card.locator("[data-prep]").fill("35");
await card.locator("[data-accept]").click();
await panel.waitForSelector(`.ocard[data-id="${orderId}"] [data-close]`, { timeout: 8000 });
check("YENİ → HAZIR geçti", true);
const stamp = await card.locator(".ostamp").textContent();
check("kartta 'alındı · 35 dk' zaman damgası", /\d{2}:\d{2}.*35/.test(stamp ?? ""), stamp?.trim());
const closeLabel = await card.locator("[data-close]").textContent();
check("kurye siparişinde buton 'Yola çıktı'", /Yola çıktı/.test(closeLabel ?? ""), closeLabel?.trim());
await panel.screenshot({ path: `${out}/1440-hazir.png` });
await card.locator("[data-close]").click();
await panel.waitForTimeout(900);
const st = await panel.evaluate(async (id) => (await (await fetch(`/api/orders/${id}`)).json()).status, orderId);
check("HAZIR → KAPANDI (delivered)", st === "delivered", st);

/* gel-al siparişinde buton metni farklı olmalı */
{
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await seedCart(c2, { brisket: 1 });
  const s2 = await c2.newPage();
  await s2.clock.install({ time: FAKE_NOW });
  await s2.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await s2.waitForTimeout(700);
  await s2.fill("input[placeholder='Ad soyad']", "Gel Al");
  await s2.fill("input[placeholder='05XX XXX XX XX']", "05321112233");
  await s2.click('button[type="submit"]');
  await s2.waitForURL(/\/odeme\/test/, { timeout: 15000 });
  await s2.getByRole("button", { name: "Ödemeyi tamamla" }).click();
  await s2.waitForURL(/\/siparis\/[0-9a-f-]{36}/, { timeout: 20000 });
  const id2 = s2.url().split("/siparis/")[1]?.split("?")[0] ?? "";
  await panel.waitForSelector(`.ocard[data-id="${id2}"]`, { timeout: 8000 });
  const c2card = panel.locator(`.ocard[data-id="${id2}"]`);
  await c2card.locator("[data-accept]").click();
  await panel.waitForSelector(`.ocard[data-id="${id2}"] [data-close]`, { timeout: 8000 });
  const lbl2 = await c2card.locator("[data-close]").textContent();
  check("gel-al siparişinde buton 'Teslim edildi'", /Teslim edildi/.test(lbl2 ?? ""), lbl2?.trim());
  /* iptal: onay ister, sebep sormaz */
  await c2card.locator(".act.danger").first().click();
  await panel.waitForSelector(`.ocard[data-id="${id2}"] [data-cancel-confirm]`, { timeout: 5000 });
  check("iptal onay ister (sebep sormaz)", (await c2card.locator("input").count()) === 0);
  await c2card.locator("[data-cancel-confirm]").click();
  await panel.waitForTimeout(900);
  const st2 = await panel.evaluate(async (id) => (await (await fetch(`/api/orders/${id}`)).json()).status, id2);
  check("iptal çalıştı", st2 === "cancelled", st2);
  await c2.close();
}

/* ---------- 4) ayarlar: sipariş kapalı ---------- */
await panel.click('.tabs button:has-text("Ayarlar")');
await panel.waitForSelector("[data-settings]", { timeout: 8000 });
await panel.screenshot({ path: `${out}/1440-ayarlar.png` });
await panel.click("[data-ordering-toggle]");
await panel.waitForTimeout(700);
const closed = await panel.evaluate(async () => (await (await fetch("/api/panel/settings")).json()).ordering_open);
check("sipariş kapalı anahtarı sunucuya yazıldı", closed === false, String(closed));
{
  /* site: ödeme "Şu an kapalıyız" demeli ve API reddetmeli */
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await seedCart(c3, { smooky: 1 });
  const s3 = await c3.newPage();
  await s3.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await s3.waitForSelector("[data-closed]", { timeout: 8000 });
  check("kapalıyken ödeme sayfası 'Şu an kapalıyız' diyor", true);
  check("kapalıyken ödeme butonu pasif", await s3.locator('button[type="submit"]').isDisabled());
  const api = await c3.request.post(base + "/api/orders", { data: { type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "X", phone: "05321234567", requested_at: "simdi" } });
  check("kapalıyken API sipariş reddediyor (409)", api.status() === 409, String(api.status()));
  await s3.screenshot({ path: `${out}/390-kapali.png` });
  await c3.close();
}
/* geri aç */
await panel.click("[data-ordering-toggle]");
await panel.waitForTimeout(700);
const reopened = await panel.evaluate(async () => (await (await fetch("/api/panel/settings")).json()).ordering_open);
check("sipariş yeniden açıldı", reopened === true);

/* ---------- 5) tükendi ---------- */
await panel.click('[data-sold-out="ayran"]');
await panel.waitForTimeout(700);
const soldOut = await panel.evaluate(async () => (await (await fetch("/api/panel/settings")).json()).sold_out);
check("tükendi işareti sunucuya yazıldı", soldOut.includes("ayran"), JSON.stringify(soldOut));
{
  const c4 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const s4 = await c4.newPage();
  await s4.goto(base + "/siparis", { waitUntil: "load" });
  await s4.waitForSelector('[data-pcard][data-sold-out]', { timeout: 10000 });
  const card4 = s4.locator('[data-pcard][data-sold-out]').first();
  check("menüde tükenen ürün soluk/üstü çizili", (await card4.evaluate((el) => getComputedStyle(el).opacity)) < "0.6");
  check("tükenen ürün sepete eklenemez (buton pasif)", await card4.locator(".addbtn").isDisabled());
  await s4.screenshot({ path: `${out}/1440-tukendi.png` });
  /* sepette varsa ödeme adımında uyarı */
  await seedCart(c4, { smooky: 1, ayran: 1 });
  await s4.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await s4.waitForSelector("[data-soldout-warn]", { timeout: 8000 });
  check("sepette tükenen ürün varsa ödemede uyarı", true);
  check("uyarı varken ödeme pasif", await s4.locator('button[type="submit"]').isDisabled());
  await c4.close();
}
/* geri al */
await panel.click('[data-sold-out="ayran"]');
await panel.waitForTimeout(700);

/* ---------- 6) gün sonu özeti ---------- */
await panel.waitForSelector("[data-summary]", { timeout: 8000 });
const sum = await panel.evaluate(() => ({
  orders: document.querySelector("[data-sum-orders]")?.textContent,
  revenue: document.querySelector("[data-sum-revenue]")?.textContent,
  top: document.querySelector("[data-sum-top]")?.textContent,
  avg: document.querySelector("[data-sum-avg]")?.textContent,
  date: document.querySelector("[data-summary-date]")?.value,
}));
check("gün sonu: sipariş sayısı ≥ 1", Number(sum.orders) >= 1, JSON.stringify(sum));
check("gün sonu: ciro var", /₺\d/.test(sum.revenue ?? ""), sum.revenue);
check("gün sonu: en çok satan ürün", (sum.top ?? "").length > 1 && sum.top !== "—", sum.top);
check("gün sonu: ortalama hazırlanma süresi > 0", /^([1-9]|\d{2,})/.test((sum.avg ?? "").trim()), sum.avg);
check("gün sonu: tarih seçilebilir", /^\d{4}-\d{2}-\d{2}$/.test(sum.date ?? ""), sum.date);
/* başka tarih → sıfır */
await panel.fill("[data-summary-date]", "2020-01-01");
await panel.waitForTimeout(900);
check("geçmiş tarihte sipariş yok", (await panel.textContent("[data-sum-orders]")) === "0");
await panel.screenshot({ path: `${out}/1440-ozet.png` });

/* ---------- 7) mobil panel + PWA ---------- */
{
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(base + "/panel", { waitUntil: "load" });
  await mp.fill("form input[type=password]", KEY);
  await mp.click("form button[type=submit]");
  await mp.waitForSelector(".tabs", { timeout: 8000 });
  /* Ayarlar sekmesinde .feed yok: sipariş listesine dön (panel sekmeyi hatırlamaz ama garanti olsun) */
  await mp.locator('.tabs button').first().click();
  await mp.waitForSelector(".feed", { timeout: 8000 });
  const cols = await mp.evaluate(() => getComputedStyle(document.querySelector(".feed")).gridTemplateColumns.split(" ").length);
  check("mobil: tek sütun", cols === 1, `${cols} sütun`);
  const small = await mp.evaluate(() => [...document.querySelectorAll(".act, .tabs button")].filter((e) => e.getBoundingClientRect().height < 40).length);
  check("mobil: dokunma hedefleri ≥ 40px", small === 0, `${small} küçük hedef`);
  await mp.screenshot({ path: `${out}/390-panel.png` });
  /* PWA manifesti */
  const man = await mctx.request.fetch(base + "/panel/manifest.webmanifest");
  const mj = man.ok() ? await man.json() : {};
  check("PWA manifesti var (/panel kapsamı, standalone)", man.ok() && mj.scope === "/panel" && mj.display === "standalone", `${man.status()} ${mj.display ?? ""}`);
  await mctx.close();
}

/* ---------- 8) çıkış ---------- */
await panel.click('[data-logout], button:has-text("Çıkış")');
await panel.waitForSelector("form input[type=password]", { timeout: 8000 });
check("çıkış çalışıyor (giriş formuna döner)", true);

await shopCtx.close();
await panelCtx.close();
await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
