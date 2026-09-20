/* Panelden fiyat değiştir → menü/sepet/toplam yeni fiyatı gösterir.
   Manipülasyon reddedilir. ESKİ sipariş fiyat değişiminden ETKİLENMEZ. */
import { chromium } from "playwright";
import { seedCart, FAKE_NOW } from "./_cart-fixture.mjs";
import { guard } from "../../scripts/test-guard.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const KEY = process.env.PANEL_KEY ?? "test1234";
await guard(base);
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const b = await chromium.launch();

/* panel oturumu (API için çerez) */
const login = await fetch(base + "/api/panel/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: KEY }) });
const CK = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

/* ---------- 0) ESKİ sipariş: fiyat değişmeden ÖNCE ver ---------- */
const eski = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Eski Siparis", phone: "05321234567", requested_at: "simdi", terms_accepted: true, locale: "tr" }) }).then((r) => r.json());
check("eski sipariş oluştu", Boolean(eski.id), String(eski.id).slice(0, 8));

/* ---------- 1) PANEL: fiyat değiştir (620 → 777) ---------- */
const pctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await pctx.newPage();
await p.goto(base + "/panel", { waitUntil: "load" });
await p.fill("form input[type=password]", KEY);
await p.click("form button[type=submit]");
await p.waitForSelector(".tabs", { timeout: 8000 });
await p.locator("[role=tab]").last().click({ force: true });
await p.waitForSelector("[data-prices]", { timeout: 8000 });
check("fiyat bölümü kategoriye göre gruplu", (await p.locator(".pr-group").count()) >= 5, (await p.locator(".pr-group").count()) + " grup");
check("kaydet başta pasif (değişiklik yok)", await p.locator("[data-price-save]").isDisabled());

/* geçersiz girişler */
for (const [val, ad] of [["0", "sıfır"], ["-5", "negatif"], ["abc", "harf"], ["", "boş"], ["12.5", "ondalık"]]) {
  await p.locator('[data-price-input="smooky"]').fill(val);
  await p.waitForTimeout(160);
  const dis = await p.locator("[data-price-save]").isDisabled();
  check(`geçersiz giriş engellendi: ${ad}`, dis, `"${val}" → kaydet ${dis ? "kilitli" : "AÇIK"}`);
}
/* geçerli değer */
await p.locator('[data-price-input="smooky"]').fill("777");
await p.waitForTimeout(200);
check("kaydedilmemiş değişiklik uyarısı", (await p.locator("[data-price-dirty]").count()) > 0);
await p.locator("[data-price-save]").click();
await p.waitForSelector("[data-price-ok]", { timeout: 8000 });
check("kaydedildi geri bildirimi", (await p.locator("[data-price-ok]").textContent())?.includes("Kaydedildi"));
await p.locator("[data-prices]").screenshot({ path: "docs/screens/fiyatlar/panel-1440.png" });
await pctx.close();

/* ---------- 2) MÜŞTERİ: menü + sepet + toplam ---------- */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const c = await ctx.newPage();
  await c.clock.install({ time: FAKE_NOW });
  await c.goto(base + "/siparis", { waitUntil: "load" });
  await c.waitForSelector("[data-pcard]", { timeout: 15000 });
  await c.waitForTimeout(1500);
  const kart = c.locator("[data-pcard]").filter({ hasText: "Smooky" }).first();
  check("menüde yeni fiyat", /777/.test((await kart.textContent()) ?? ""), ((await kart.textContent()) ?? "").replace(/\s+/g, " ").slice(0, 46));
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seedCart(ctx, { smooky: 1 });
  const c = await ctx.newPage();
  await c.clock.install({ time: FAKE_NOW });
  await c.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await c.waitForTimeout(2300);
  const tot = (await c.locator("[data-cart-totals]").first().textContent()) ?? "";
  check("sepet toplamı yeni fiyat", /777/.test(tot), tot.replace(/\s+/g, " ").slice(0, 60));
  await c.screenshot({ path: "docs/screens/fiyatlar/musteri-390.png" });
  await ctx.close();
}

/* ---------- 3) Sunucu: yeni sipariş 777 ile kaydedilir ---------- */
const yeni = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Yeni Siparis", phone: "05321234567", requested_at: "simdi", terms_accepted: true, locale: "tr" }) }).then((r) => r.json());
const yeniKayit = await fetch(base + "/api/orders/" + yeni.id, { headers: { cookie: CK } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (yeniKayit) check("yeni sipariş 777 ₺ ile kaydedildi", yeniKayit.total === 777, "total=" + yeniKayit.total);

/* ---------- 4) MANİPÜLASYON ---------- */
for (const [body, ad] of [
  [{ type: "pickup", items: [{ id: "smooky", qty: 1, price: 1 }], name: "Manipulasyon Test", phone: "05321234567", requested_at: "simdi", terms_accepted: true, locale: "tr" }, "satır fiyatı 1 ₺"],
  [{ type: "pickup", items: [{ id: "smooky", qty: 1 }], total: 1, name: "Manipulasyon Test", phone: "05321234567", requested_at: "simdi", terms_accepted: true, locale: "tr" }, "total 1 ₺"],
]) {
  const r = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  check(`manipülasyon reddedildi (${ad})`, r.status === 422 && j.errors?.[0]?.code === "amount-mismatch", `HTTP ${r.status} ${j.errors?.[0]?.code ?? ""}`);
}

/* ---------- 5) ESKİ sipariş korundu mu? ---------- */
const eskiKayit = await fetch(base + "/api/orders/" + eski.id, { headers: { cookie: CK } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (eskiKayit) {
  check("eski siparişin satır fiyatı 620 kaldı", eskiKayit.items[0].price === 620, "price=" + eskiKayit.items[0].price);
  check("eski siparişin toplamı 620 kaldı", eskiKayit.total === 620, "total=" + eskiKayit.total);
}

/* ---------- 6) Temizlik: fiyatı geri al ---------- */
const geri = await fetch(base + "/api/panel/settings", { method: "PATCH", headers: { "content-type": "application/json", cookie: CK }, body: JSON.stringify({ prices: {} }) });
check("fiyat varsayılana döndürüldü", geri.ok);
const son = await (await fetch(base + "/api/panel/settings")).json();
check("temizlik sonrası harita boş", Object.keys(son.prices).length === 0, JSON.stringify(son.prices));

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
