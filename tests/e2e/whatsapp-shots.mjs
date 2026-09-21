/**
 * WhatsApp sipariş kanalı — RAPOR EKRAN GÖRÜNTÜLERİ (doğrulama testi değil).
 *
 * Ödeme butonunun yerini alan "WhatsApp'tan Sipariş Ver" akışını belgeler:
 * ödeme sayfası (onay kutusu kilidi) → gönderim → sipariş no ekranı.
 *
 * wa.me GERÇEKTEN AÇILMAZ: window.open yamalanıp URL yakalanıyor, yoksa koşu
 * WhatsApp'a gider. Açılan URL yine de doğrulanıyor.
 *
 * Koşma: pnpm test:server çalışırken → node tests/e2e/whatsapp-shots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { FAKE_NOW, assertServerReady, seedCart } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/whatsapp";
mkdirSync(out, { recursive: true });

await assertServerReady(base);
const browser = await chromium.launch();
const notlar = [];

/**
 * @param tur "delivery" → Kurye (mahalle + adres), "pickup" → Gel-al
 */
async function akis(tag, w, h, tur) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
  /* Sepeti doğrudan kur: kurye min-sepet eşiğini geçsin (2× Smooky = 1240 TL). */
  await seedCart(ctx, { smooky: 2, kola: 1 });
  const p = await ctx.newPage();
  await p.clock.install({ time: FAKE_NOW });

  /* window.open'ı yakala: wa.me'ye GİTME, URL'yi sakla. */
  await p.addInitScript(() => {
    window.__wa = null;
    window.open = (u) => { window.__wa = String(u); return null; };
  });

  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(700);

  if (tur === "delivery") {
    await p.getByRole("button", { name: "Kurye" }).click();
    await p.waitForSelector("select[aria-label=Mahalle]", { timeout: 5000 });
    await p.selectOption("select[aria-label=Mahalle]", "merkez");
    await p.fill("textarea", "Cumhuriyet Mah. Örnek Sk. No:5");
  } else {
    await p.getByRole("button", { name: "Gel-al" }).click();
  }
  await p.fill("input[placeholder='Ad soyad']", "Ornek Musteri");
  await p.fill("input[placeholder='05XX XXX XX XX']", "0532 123 45 67");
  await p.waitForTimeout(400);

  /* 1) ONAY KUTUSU İŞARETSİZ → buton kilitli (raporun kanıt karesi) */
  const buton = p.locator("button", { hasText: /WhatsApp/i }).first();
  const kilitli = await buton.isDisabled().catch(() => null);
  notlar.push(`${tag}: onay işaretsizken buton ${kilitli ? "KİLİTLİ ✓" : "AÇIK ✗"}`);
  await p.screenshot({ path: `${out}/${tag}-1-onaysiz.png`, fullPage: true });

  /* 2) Onay işaretlenince buton açılır */
  await p.locator("[data-terms-check]").check();
  await p.waitForTimeout(300);
  notlar.push(`${tag}: onay işaretlenince buton ${(await buton.isEnabled()) ? "AÇIK ✓" : "KİLİTLİ ✗"}`);
  await p.screenshot({ path: `${out}/${tag}-2-onayli.png`, fullPage: true });

  /* 3) Gönder → sipariş no ekranı */
  await buton.click();
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${out}/${tag}-3-siparis-no.png`, fullPage: true });

  const wa = await p.evaluate(() => window.__wa);
  notlar.push(`${tag}: wa.me açıldı → ${wa ? wa.slice(0, 64) + "…" : "(YOK ✗)"}`);
  if (wa) {
    const metin = decodeURIComponent(new URL(wa).searchParams.get("text") ?? "");
    notlar.push(`${tag}: mesaj ilk satır → ${metin.split("\n")[0]}`);
  }
  /* Sipariş no'yu gövde metninden ARAMA: sayfadaki başka bir kelime tutabiliyor.
     Onay kutusunun kendi kancasından oku. */
  const kutuMetni = (await p.locator("[data-wa-done]").textContent().catch(() => null)) ?? "";
  const kod = kutuMetni.match(/#([A-HJ-NP-Z2-9]{6})/)?.[1] ?? null;
  notlar.push(`${tag}: sipariş no kutusu → ${kod ?? "(görünmüyor ✗)"}`);

  await ctx.close();
}

await akis("1440-kurye", 1440, 900, "delivery");
await akis("390-gelal", 390, 844, "pickup");

await browser.close();
console.log(notlar.join("\n"));
console.log(`\nkareler: ${out}/`);
