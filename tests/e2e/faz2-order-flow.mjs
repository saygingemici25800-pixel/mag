// Sipariş akışı (Faz 5 kurgusu): liste → sheet → sepet çubuğu → /siparis/odeme → mock ödeme.
// Not: Faz 2'de tek sayfaydı (article.card + form aynı sayfada); Faz 5'te ikiye ayrıldı ve
// teslimatta nakit/kart kalktı. Bu test o değişikliğe göre güncellendi.
import { chromium } from "playwright";
import { FAKE_NOW, PANEL_KEY, assertServerReady, clearCart, fillDelivery, waitForCartCount } from "./_cart-fixture.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? ".";
await assertServerReady(base);
const browser = await chromium.launch();
const errs = [];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const shot = (page, name) => page.screenshot({ path: `${out}/order-${name}.png`, fullPage: false });

for (const vp of [{ w: 1440, h: 860, tag: "d" }, { w: 390, h: 844, tag: "m" }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.clock.install({ time: FAKE_NOW }); // dükkân açık (sunucu: MAG_FAKE_NOW)
  await clearCart(page);
  page.on("pageerror", (e) => errs.push(`[${vp.tag}] ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errs.push(`[${vp.tag}] ${m.text()}`));

  await page.goto(base + "/siparis", { waitUntil: "load" });
  await page.waitForTimeout(800);
  await shot(page, `${vp.tag}-1-menu`);

  // Smooky: sheet'ten adet 2 ile ekle
  await page.locator("article.pcard", { hasText: "Smooky" }).first().click();
  await page.waitForSelector(".sheet", { timeout: 5000 });
  await page.locator(".sheet .qty button[aria-label=Artır]").click();
  await page.locator(".sheet .submit").click();
  await waitForCartCount(page, 2);
  await shot(page, `${vp.tag}-2-sheet`);

  // Ayran: kart üzerindeki + Ekle
  await page.locator("article.pcard", { hasText: "Arslan ayran" }).locator("button.addbtn").click();
  await waitForCartCount(page, 3);
  check(`[${vp.tag}] sepet çubuğu 3 ürün`, (await page.$eval(".cb-badge", (e) => e.textContent)) === "3");
  await shot(page, `${vp.tag}-3-cart`);

  // ödeme sayfası
  await page.locator(".cartbar2").click();
  await page.waitForURL(/\/siparis\/odeme/, { timeout: 8000 });
  await page.waitForTimeout(600);
  check(`[${vp.tag}] ödemede 2 satır`, (await page.locator(".line:visible").count()) === 2);

  await fillDelivery(page, { address: "Cumhuriyet Mah. Test Sk. No:1 D:2", name: "Test Müşteri", phone: "0532 123 45 67" });
  const warn = await page.locator(".warn:visible").count();
  check(`[${vp.tag}] min sepet uyarısı yok (1290 ≥ min)`, warn === 0, `warn=${warn}`);

  // yalnızca online ödeme: "Ödemeye geç" → mock sağlayıcı
  await page.getByRole("button", { name: /Ödemeye geç/ }).click();
  await page.waitForURL(/\/odeme\/test\?ref=/, { timeout: 15000 });
  check(`[${vp.tag}] mock ödeme sayfasına yönlendi`, true);
  await page.locator("form:has(input[value=ok]) button").click();
  await page.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 });
  await page.waitForTimeout(600);
  const id = page.url().split("/").pop();
  check(`[${vp.tag}] sipariş oluştu ve ödendi`, (await page.getAttribute("[data-payment]", "data-payment")) === "paid", id);
  await shot(page, `${vp.tag}-4-track`);

  // durum güncelleme (panel anahtarı varsa)
  const patch = await fetch(`${base}/api/orders/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-panel-key": PANEL_KEY },
    body: JSON.stringify({ status: "preparing" }),
  });
  const got = await (await fetch(`${base}/api/orders/${id}`)).json();
  check(`[${vp.tag}] panel anahtarıyla durum güncellendi`, patch.status === 200 && got.status === "preparing", `PATCH=${patch.status} status=${got.status}`);
  console.log(`[${vp.tag}] total: ${got.total} zone: ${got.zone}`);
  await page.close();
}

// doğrulama: kötü telefon + eksik alanlar → 422
const bad = await fetch(base + "/api/orders", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "delivery", zone: "oludeniz", items: [{ id: "ayran", qty: 1 }], name: "A", phone: "123", address: "x", requested_at: "simdi" }),
});
check("geçersiz sipariş 422", bad.status === 422, `status=${bad.status}`);
console.log("errors:", errs.length ? errs : "none");
await browser.close();
process.exit(fail ? 1 : 0);
