/**
 * Panel fiyat ekranı — GERÇEK ARAYÜZ akışı bozulmadı mı (24 Eyl 2026).
 *
 * API'de `prices` varsayılanı birleştirmeye çevrildi. Panel ekranı SEYREK harita
 * gönderdiği için `replace:true` eklendi; bu paket iki şeyi birden bekler:
 *   1) panelden fiyat kaydetmek çalışıyor,
 *   2) panelden fiyat SİLMEK (alanı boşaltmak) hâlâ ezmeyi kaldırıyor.
 *
 * Koşma: pnpm test:server çalışırken → node tests/e2e/panel-fiyat-akisi.mjs
 */
import { chromium } from "playwright";
import { PANEL_KEY as KEY, assertServerReady } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
await assertServerReady(base);

let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};
const H = { "content-type": "application/json", "x-panel-key": KEY };
const oku = async () => (await fetch(base + "/api/panel/settings", { cache: "no-store" })).json();

/* Bilinen başlangıç: iki ürünün ezmesi olsun. */
await fetch(base + "/api/panel/settings", {
  method: "PATCH", headers: H,
  body: JSON.stringify({ prices: { smooky: 680, brisket: 600, limonata: 140 }, replace: true }),
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage();

await p.goto(base + "/panel", { waitUntil: "load" });
await p.fill("form input[type=password]", KEY);
await p.click("form button[type=submit]");
await p.waitForSelector(".tabs", { timeout: 10000 });

/* Fiyat ekranı AYARLAR sekmesinin altında (ayrı bir üst sekme değil). */
await p.locator(".tabs button, .tabs a").filter({ hasText: "Ayarlar" }).first().click();
await p.waitForSelector("[data-prices]", { timeout: 10000 });

/* Ekranın kendi kancaları: [data-price-input="<id>"] ve [data-price-save]. */
const hedef = p.locator('[data-price-input="smooky"]');
await hedef.waitFor({ timeout: 10000 });
check("fiyat ekranı açıldı", await hedef.count() === 1);

const kaydet = p.locator("[data-price-save]");

/* --- 1) FİYAT KAYDETME --- */
await hedef.scrollIntoViewIfNeeded();
await hedef.fill("777");
await kaydet.click();
await p.waitForTimeout(2000);

{
  const s2 = await oku();
  check("panelden fiyat kaydedildi (smooky=777)", s2.prices?.smooky === 777, "smooky=" + s2.prices?.smooky);
  check("→ diğer ezmeler korundu", s2.prices?.brisket === 600 && s2.prices?.limonata === 140, `brisket=${s2.prices?.brisket} limonata=${s2.prices?.limonata}`);
}

/* --- 2) FİYAT SİLME: alanı boşaltmak ezmeyi kaldırmalı ---
   Fiyatı olan ürünün alanı boşaltılamıyor (panel kilitliyor). Ezme kaldırma
   yolu: alana KOD VARSAYILANINI yazmak → seyrek haritaya girmez → replace ile
   ezme kalkar. smooky kod fiyatı 620. */
await hedef.fill("620");
await kaydet.click();
await p.waitForTimeout(2000);
{
  const s = await oku();
  check("panelden ezme KALDIRILDI (kod varsayılanı yazılınca)", s.prices?.smooky === undefined, "smooky=" + s.prices?.smooky);
  check("→ diğer ezmeler yine korundu", s.prices?.brisket === 600 && s.prices?.limonata === 140, `brisket=${s.prices?.brisket} limonata=${s.prices?.limonata}`);
}

await browser.close();
console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
process.exit(fail ? 1 : 0);
