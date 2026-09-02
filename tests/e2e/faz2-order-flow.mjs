import { chromium } from "playwright";
const base = "http://localhost:3111";
const browser = await chromium.launch();
const errs = [];
async function shot(page, name) { await page.screenshot({ path: `order-${name}.png`, fullPage: false }); }
for (const vp of [{ w: 1440, h: 860, tag: "d" }, { w: 390, h: 844, tag: "m" }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  page.on("pageerror", (e) => errs.push(`[${vp.tag}] ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errs.push(`[${vp.tag}] ${m.text()}`));
  await page.goto(base + "/siparis", { waitUntil: "load" });
  await page.waitForTimeout(800);
  await shot(page, `${vp.tag}-1-menu`);
  await page.getByRole("button", { name: "Kurye" }).click();
  await page.getByRole("button", { name: "Minimum sepet tutarları" }).click();
  await page.waitForTimeout(300);
  await shot(page, `${vp.tag}-2-mininfo`);
  await page.keyboard.press("Escape");
  await page.selectOption("select[aria-label='Mahalle']", "merkez");
  // Smooky ekle + artır, Ayran ekle
  const smooky = page.locator("article.card", { hasText: "Smooky" }).first();
  await smooky.getByRole("button", { name: "Ekle" }).click();
  await smooky.getByRole("button", { name: "Artır" }).click();
  await page.locator("article.card", { hasText: "Arslan ayran" }).getByRole("button", { name: "Ekle" }).click();
  if (vp.tag === "m") { await page.getByRole("button", { name: "Sepeti aç" }).click(); await page.waitForTimeout(600); }
  await shot(page, `${vp.tag}-3-cart`);
  const warn = await page.locator(".warn").count();
  console.log(`[${vp.tag}] min-cart warn visible (1240 ≥ 800 → 0 beklenir):`, warn);
  await page.fill("input[placeholder='Ad soyad']", "Test Müşteri");
  await page.fill("input[placeholder='05XX XXX XX XX']", "0532 123 45 67");
  await page.fill("textarea", "Cumhuriyet Mah. Test Sk. No:1 D:2");
  await page.getByRole("button", { name: "Siparişi onayla" }).click();
  await page.waitForURL(/\/siparis\/MAG-/, { timeout: 15000 });
  await page.waitForTimeout(800);
  const id = page.url().split("/").pop();
  console.log(`[${vp.tag}] order created:`, id, "| h1:", (await page.locator("h1").innerText()).replace(/\n/g, " "));
  await shot(page, `${vp.tag}-4-track`);
  // durum güncelle → takip sayfası yoklamadan önce doğrudan GET/PATCH doğrula
  const patch = await fetch(`${base}/api/orders/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "hazirlaniyor" }) });
  const got = await (await fetch(`${base}/api/orders/${id}`)).json();
  console.log(`[${vp.tag}] PATCH`, patch.status, "GET status:", got.status, "total:", got.total, "phone:", got.phone, "zone:", got.zone);
  await page.close();
}
// doğrulama: boş sepet / kötü telefon / min sepet altı / kapalı saat
const bad = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "delivery", zone: "oludeniz", items: [{ id: "ayran", qty: 1 }], name: "A", phone: "123", address: "x", requested_at: "simdi", payment: "cod" }) });
console.log("validation 422 →", bad.status, JSON.stringify((await bad.json()).errors));
console.log("errors:", errs.length ? errs : "none");
await browser.close();
