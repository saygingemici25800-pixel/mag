/**
 * CANLI SİTE — 7 ürünün fiyatının menüde göründüğünü ve sipariş edilebilir
 * olduğunu belgeler (22 Eyl 2026 fiyat/teslimat girişi sonrası).
 *
 * Canlıya YAZMAZ: yalnız menü sayfasını okur ve sepete ekleme (localStorage)
 * dener. Sipariş kurulmaz.
 *
 * Koşma: node tests/e2e/canli-fiyat-kanit.mjs [taban]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "https://magstreetfood.com";
const out = "docs/screens/fiyat";
mkdirSync(out, { recursive: true });

/* Beklenen ETKİN fiyatlar — canlı panelden okunan değerler. */
const BEKLENEN = [
  { ad: "MAG ÇITIR", fiyat: "540" },
  { ad: "Limonata", fiyat: "140" },
  { ad: "Tütsü biberli aioli", fiyat: "50", sos: true },
  { ad: "Jalapeno", fiyat: "50", sos: true },
  { ad: "Sweet & chili", fiyat: "50", sos: true },
  { ad: "Trüflü mayonez", fiyat: "50", sos: true },
  { ad: "Mag sos", fiyat: "50", sos: true },
];

/* CANLI SİTEYE bakar (varsayılan taban magstreetfood.com) — yerel test
   paketinde KOŞMAZ: yerel sunucuya yöneltilirse canlıdaki veriyi bekleyen
   kontroller boşuna düşer. Bilerek koşmak için:
       MAG_ALLOW_LIVE=1 node tests/e2e/canli-fiyat-kanit.mjs
   Yalnız OKUMA yapar; canlıya sipariş/kayıt yazmaz. */
if (process.env.MAG_ALLOW_LIVE !== "1") {
  console.error("\ncanli-fiyat-kanit CANLI siteyi okur; normal pakette atlanır.");
  console.error("Bilerek koşacaksan: MAG_ALLOW_LIVE=1 node tests/e2e/canli-fiyat-kanit.mjs\n");
  process.exit(0);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};

await p.goto(base + "/siparis", { waitUntil: "load" });
await p.waitForSelector("article.pcard", { timeout: 20000 });
/* lazy görseller + alt kategoriler yüklensin */
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(2500);
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(600);

/**
 * Kartı ADIN TAM KARŞILIĞIYLA bul.
 *
 * `hasText: "Mag sos"` YANLIŞ eşleşiyor: Caesar burgerinin AÇIKLAMASINDA
 * "Mag sos, marul, gravyer…" geçtiği için o kart da tutuyordu — ölçüm sosun
 * değil burgerin fiyatını okuyordu. Ürün adı .tname başlığında; eşleşme
 * oradan ve tam metinle yapılır.
 */
const tamAd = (ad) =>
  p.locator(".tname", { hasText: new RegExp(`^\\s*${ad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") });

/* Sos bölümünün kartları: "Jalapeno" adı burgerde DE var (sos jalapeno-sos,
   burger jalapeno — ikisinin de görünen adı "Jalapeno"). Bu yüzden sos
   aranırken kapsam sos ızgarasına daraltılır. */
const sosGrid = p.locator("section, .catblock").filter({ has: p.locator("h2, .cattitle", { hasText: /^Sos/i }) }).last();

const kartiBul = (ad, sosMu = false) =>
  (sosMu ? sosGrid : p).locator("article.pcard").filter({ has: tamAd(ad) }).first();

for (const { ad, fiyat, sos } of BEKLENEN) {
  const kart = kartiBul(ad, sos);
  if (!(await kart.count())) {
    check(`menüde: ${ad}`, false, "kart bulunamadı");
    continue;
  }
  const metin = (await kart.textContent()) ?? "";
  const yazili = metin.replace(/\s/g, "").includes("₺" + fiyat);
  /* "Yakında" etiketi = fiyatsız koruma HÂLÂ açık demek; olmamalı */
  const yakinda = /Yakında/i.test(metin);
  const pasif = await kart.getAttribute("data-sold-out");
  check(`${ad}: fiyat ₺${fiyat} görünüyor`, yazili, metin.replace(/\s+/g, " ").slice(0, 70));
  check(`${ad}: sipariş edilebilir (Yakında/pasif değil)`, !yakinda && !pasif, `yakında=${yakinda} pasif=${pasif}`);
}

/* SEPETE EKLEME — bir sos gerçekten eklenebiliyor mu */
const sosKart = kartiBul("Mag sos", true);
await sosKart.scrollIntoViewIfNeeded();
await sosKart.locator("button.addbtn").click();
await p.waitForTimeout(2500);
const sepet = await p.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("mag:cart") ?? "{}").lines ?? {};
  } catch {
    return {};
  }
});
check("sos sepete eklendi", !!sepet["mag-sos"], JSON.stringify(sepet));

/* Sos bölümünün karesi */
const bas = p.locator("h2, .cattitle").filter({ hasText: /^Sos/i }).first();
if (await bas.count()) {
  await bas.scrollIntoViewIfNeeded();
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/canli-sos.png` });
}
/* Yan ürünler (MAG ÇITIR — 25 Eyl 2026'da citir-tavuk bu adı aldı) */
const citir = kartiBul("MAG ÇITIR");
if (await citir.count()) {
  await citir.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/canli-yan.png` });
}
/* Limonata (içecekler) */
const lim = kartiBul("Limonata");
if (await lim.count()) {
  await lim.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/canli-icecek.png` });
}

await browser.close();
console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
console.log(`kareler: ${out}/`);
process.exit(fail ? 1 : 0);
