/**
 * MAG ÇITIR tutarlılık kanıtı (25 Eyl 2026).
 *
 * İki değişikliğin dört yerde de tuttuğunu belgeler:
 *   · ₺490'lık eski "MAG ÇITIR" (id: citir) HİÇBİR YERDE olmamalı
 *   · citir-tavuk'un adı üç dilde de "MAG ÇITIR" olmalı (marka adı, çevrilmez)
 *
 * Dört yer: menü · sepet · WhatsApp mesajı · panel fiyat ekranı.
 * CANLIDA yalnız OKUMA; WhatsApp mesajı ve panel YEREL sunucudan alınır
 * (canlıya test siparişi yazılmaz).
 *
 * Koşma: MAG_ALLOW_LIVE=1 node tests/e2e/mag-citir-kanit.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { PANEL_KEY } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "https://magstreetfood.com";
const yerel = process.env.MAG_LOCAL ?? "http://localhost:3112";
const out = "docs/screens/mag-citir";
mkdirSync(out, { recursive: true });

if (process.env.MAG_ALLOW_LIVE !== "1") {
  console.error("\nmag-citir-kanit CANLI siteyi okur; normal pakette atlanır.");
  console.error("Bilerek koşacaksan: MAG_ALLOW_LIVE=1 node tests/e2e/mag-citir-kanit.mjs\n");
  process.exit(0);
}

const AD = "MAG ÇITIR";
const ESKI = "Çıtır Tavuk";
let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};

const browser = await chromium.launch();

/* ---- 1) MENÜ (üç dil, canlı) ---- */
for (const [dil, yol] of [["tr", "/siparis"], ["en", "/en/siparis"], ["ru", "/ru/siparis"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(base + yol, { waitUntil: "load" });
  await p.waitForSelector("article.pcard", { timeout: 20000 });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(2000);

  const adlar = await p.locator("article.pcard .tname").allTextContents();
  const magSayisi = adlar.filter((a) => a.trim() === AD).length;
  check(`${dil} menü: "${AD}" TAM 1 kez`, magSayisi === 1, `${magSayisi} kart`);
  check(`${dil} menü: "${ESKI}" yok`, !adlar.some((a) => a.includes(ESKI)), adlar.filter((a) => a.includes(ESKI)).join(", ") || "temiz");
  check(`${dil} menü: ürün sayısı 33`, adlar.length === 33, adlar.length + " ürün");

  if (dil === "tr") {
    const kart = p.locator("article.pcard").filter({ has: p.locator(".tname", { hasText: AD }) }).first();
    await kart.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    const metin = (await kart.textContent()) ?? "";
    check("tr menü: fiyat ₺540", metin.replace(/\s/g, "").includes("₺540"), metin.replace(/\s+/g, " ").slice(0, 60));
    await p.screenshot({ path: `${out}/1-menu.png` });
  }
  await ctx.close();
}

/* ---- 2) SEPET (canlı, okuma) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { "citir-tavuk": { qty: 1, note: "" } } }));
    localStorage.setItem("mag:sound", "0");
  });
  const p = await ctx.newPage();
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(1800);
  const satir = (await p.locator(".line").allTextContents()).join(" | ");
  check("sepet: ad MAG ÇITIR", satir.includes(AD), satir.slice(0, 70));
  check("sepet: eski ad yok", !satir.includes(ESKI));
  await p.screenshot({ path: `${out}/2-sepet.png`, fullPage: true });
  await ctx.close();
}

/* ---- 3) WhatsApp MESAJI (YEREL — canlıya sipariş yazmıyoruz) ---- */
{
  const r = await fetch(yerel + "/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "pickup", items: [{ id: "citir-tavuk", qty: 1 }],
      name: "Test Kullanici", phone: "05321234567", requested_at: "simdi",
      locale: "tr", terms_accepted: true, channel: "whatsapp",
    }),
  });
  const j = await r.json();
  const satir = String(j.message ?? "").split("\n").find((l) => /ÇITIR|Çıtır/i.test(l)) ?? "";
  check("WhatsApp mesajı: ad MAG ÇITIR", satir.includes(AD), satir || JSON.stringify(j.errors ?? j).slice(0, 80));
  check("WhatsApp mesajı: eski ad yok", !String(j.message ?? "").includes(ESKI));
}

/* ---- 4) PANEL fiyat ekranı (YEREL, okuma) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const p = await ctx.newPage();
  await p.goto(yerel + "/panel", { waitUntil: "load" });
  await p.fill("form input[type=password]", PANEL_KEY);
  await p.click("form button[type=submit]");
  await p.waitForSelector(".tabs", { timeout: 10000 });
  await p.locator(".tabs button, .tabs a").filter({ hasText: "Ayarlar" }).first().click();
  await p.waitForSelector("[data-prices]", { timeout: 10000 });

  const satir = p.locator('[data-price-row="citir-tavuk"]');
  await satir.scrollIntoViewIfNeeded();
  const metin = ((await satir.textContent()) ?? "").replace(/\s+/g, " ").trim();
  check("panel: ad MAG ÇITIR", metin.includes(AD), metin.slice(0, 60));
  check("panel: eski citir satırı YOK", (await p.locator('[data-price-row="citir"]').count()) === 0);
  const tumu = (await p.locator("[data-prices]").textContent()) ?? "";
  check("panel: eski ad hiç geçmiyor", !tumu.includes(ESKI));
  await p.locator("[data-prices]").screenshot({ path: `${out}/4-panel.png` });
  await ctx.close();
}

await browser.close();
console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
console.log(`kareler: ${out}/`);
process.exit(fail ? 1 : 0);
