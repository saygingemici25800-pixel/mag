// Sipariş akışı (Faz 5 kurgusu): liste → sheet → sepet çubuğu → /siparis/odeme → mock ödeme.
// Not: Faz 2'de tek sayfaydı (article.card + form aynı sayfada); Faz 5'te ikiye ayrıldı ve
// teslimatta nakit/kart kalktı. Bu test o değişikliğe göre güncellendi.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { FAKE_NOW, PANEL_KEY, assertServerReady, clearCart, fillDelivery, waitForCartCount } from "./_cart-fixture.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
/* Ekran görüntüleri docs/screens/ altına (gitignore'lu); kök dizine YAZILMAZ. */
const out = process.argv[3] ?? "docs/screens/siparis-akisi";
mkdirSync(out, { recursive: true });
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

  /* 21 Eyl 2026 — GEÇİCİ WHATSAPP KANALI: ödeme sayfasına yönlendirme YOK.
     Buton yeni sekmede wa.me açıyor; sipariş öncesinde "whatsapp" durumuyla
     yazılıyor. Ödeme rotası silinmedi, ileride geri açılacak. */
  await page.locator("[data-terms-check]").check().catch(() => {});
  /* wa.me yeni sekmede açılır — popup'ı yakala ki gerçek gezinme olmasın. */
  const popupSozu = page.context().waitForEvent("page", { timeout: 15000 }).catch(() => null);
  await page.getByRole("button", { name: /WhatsApp/i }).click();
  const popup = await popupSozu;
  const waUrl = popup ? popup.url() : "";
  /* wa.me 302 ile api.whatsapp.com/send/'e yönlendiriyor (WhatsApp'ın kendi
     davranışı, doğrulandı). Popup yönlendirme SONRASI url'i verebilir, ikisi de
     kabul: numara ve encode edilmiş metin her iki biçimde de var. */
  const waTamam = /^https:\/\/(wa\.me\/905367086584\?text=|api\.whatsapp\.com\/send\/\?phone=905367086584)/.test(waUrl);
  check(`[${vp.tag}] WhatsApp yeni sekmede açıldı`, waTamam, waUrl.slice(0, 70));
  /* Satır sonu: wa.me'de %0A, yönlendirme sonrası + (form-encoding) olabilir. */
  check(`[${vp.tag}] mesaj encode edildi`, waUrl.includes("%0A") || waUrl.includes("text=MAG"), waUrl.slice(60, 100));
  await popup?.close().catch(() => {});
  /* Sipariş no ekranda kalıyor; panelde bu no ile bulunacak. */
  await page.waitForSelector("[data-wa-code]", { timeout: 10000 });
  const kod = (await page.textContent("[data-wa-code]"))?.match(/#([A-Z2-9]{6})/)?.[1] ?? "";
  check(`[${vp.tag}] 6 karakterlik sipariş no gösterildi`, /^[A-Z2-9]{6}$/.test(kod), kod);
  /* Kayıt: durum whatsapp, ödeme alınmamış, no mesajdakiyle aynı */
  const ham = await (await fetch(`${base}/api/orders?limit=20`, { headers: { "x-panel-key": PANEL_KEY } })).json();
  const liste = Array.isArray(ham) ? ham : (ham.orders ?? []);
  const kayit = liste.find((o) => o.order_code === kod);
  check(`[${vp.tag}] sipariş kaydı var, no eşleşiyor`, !!kayit, kod);
  check(`[${vp.tag}] durum whatsapp, ödeme alınmamış`, kayit?.status === "whatsapp" && kayit?.payment_status === "awaiting_payment", `${kayit?.status}/${kayit?.payment_status}`);
  const id = kayit?.id;
  await shot(page, `${vp.tag}-4-whatsapp`);

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
  body: JSON.stringify({ type: "delivery", zone: "oludeniz", items: [{ id: "ayran", qty: 1 }], name: "A", phone: "123", address: "x", requested_at: "simdi", terms_accepted: true }),
});
check("geçersiz sipariş 422", bad.status === 422, `status=${bad.status}`);
/* ---------- MESAFELİ SATIŞ ONAYI (zorunlu) ----------
   Yönetmelik: onay sipariş ONAYINDAN ÖNCE alınmalı. Arayüzde kutu işaretlenmeden
   buton pasif ama buna güvenilmez — istek doğrudan API'ye de gelebilir. */
for (const [govde, ad] of [
  [{ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Onay Test", phone: "05321234567", requested_at: "simdi" }, "bayrak YOK"],
  [{ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Onay Test", phone: "05321234567", requested_at: "simdi", terms_accepted: false }, "false"],
  [{ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Onay Test", phone: "05321234567", requested_at: "simdi", terms_accepted: "evet" }, "metin 'evet'"],
]) {
  const r = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(govde) });
  const b2 = await r.json().catch(() => ({}));
  const terms = (b2.errors ?? []).some((e) => e.field === "terms" && e.code === "required");
  check(`onaysız sipariş reddedildi (${ad})`, r.status === 422 && terms, `HTTP ${r.status} ${JSON.stringify(b2.errors ?? b2).slice(0, 60)}`);
}
{
  /* Onaylı sipariş: kayda onay damgası YAZILMALI (uyuşmazlıkta kanıt) */
  const r = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Onay Test", phone: "05321234567", requested_at: "simdi", terms_accepted: true }) });
  const j = await r.json();
  check("onaylı sipariş oluştu", r.status === 201 && !!j.id, `HTTP ${r.status}`);
  if (j.id) {
    const o = await (await fetch(`${base}/api/orders/${j.id}`)).json();
    check("kayıtta terms_accepted_at var", typeof o.terms_accepted_at === "string" && o.terms_accepted_at.length > 10, String(o.terms_accepted_at));
    check("kayıtta terms_version var", typeof o.terms_version === "string" && o.terms_version.length > 0, String(o.terms_version));
    check("onay zamanı SUNUCU saati (created_at ile aynı an)", o.terms_accepted_at === o.created_at, `${o.terms_accepted_at} vs ${o.created_at}`);
  }
}

console.log("errors:", errs.length ? errs : "none");
await browser.close();
process.exit(fail ? 1 : 0);
