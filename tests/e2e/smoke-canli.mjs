/**
 * CANLI SMOKE TEST — magstreetfood.com (25 Eyl 2026).
 *
 * YALNIZ OKUMA ve normal akış. Yıkıcı işlem YOK: hiçbir ayar değiştirilmez,
 * hiçbir kayıt silinmez. WhatsApp akışı gerçek sipariş KURAR (normal akışın
 * kendisi budur) ama mesaj GÖNDERİLMEZ ve kurulan kayıtlar sonunda raporlanır
 * ki temizlenebilsin.
 *
 * Kapsam: tüm sayfalar × TR/EN/RU × mobil(390)+masaüstü(1440),
 *         WhatsApp kurye + gel-al, panel (giriş, fiyat, mahalle, servis, rapor).
 *
 * Koşma: MAG_ALLOW_LIVE=1 node tests/e2e/smoke-canli.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const base = process.argv[2] ?? "https://magstreetfood.com";
const out = "docs/screens/smoke";
mkdirSync(out, { recursive: true });

if (process.env.MAG_ALLOW_LIVE !== "1") {
  console.error("\nsmoke-canli CANLI siteyi okur; normal pakette atlanır.");
  console.error("Bilerek koşacaksan: MAG_ALLOW_LIVE=1 node tests/e2e/smoke-canli.mjs\n");
  process.exit(0);
}

/* Panel anahtarı .env.local'dan — ekrana YAZILMAZ. */
let PANEL = process.env.PANEL_KEY || "";
if (!PANEL) {
  try {
    for (const l of readFileSync(".env.local", "utf8").split("\n")) {
      const t = l.trim();
      if (t.startsWith("PANEL_KEY=")) PANEL = t.slice("PANEL_KEY=".length).trim();
    }
  } catch { /* yok */ }
}

let fail = 0;
const bozuk = [];
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) { fail++; bozuk.push(`${n}${x ? " — " + x : ""}`); }
};

const browser = await chromium.launch();
const EKRAN = [
  { ad: "1440", w: 1440, h: 900, mobil: false },
  { ad: "390", w: 390, h: 844, mobil: true },
];
/* Galeri slug'ı DİLE GÖRE yerelleşmiş: /galeri · /en/gallery · /ru/galereya.
   İletişim AYRI SAYFA DEĞİL — her sayfada açılan bir katman ([data-contact-open]),
   bu yüzden sayfa listesinde yok, aşağıda ayrıca sınanıyor. */
const DILLER = [
  { kod: "tr", on: "", galeri: "/galeri" },
  { kod: "en", on: "/en", galeri: "/en/gallery" },
  { kod: "ru", on: "/ru", galeri: "/ru/galereya" },
];
const SAYFALAR = [
  { ad: "ana", yol: "/", bekle: "body" },
  { ad: "menu", yol: "/siparis", bekle: "article.pcard" },
  { ad: "odeme", yol: "/siparis/odeme", bekle: "body" },
  { ad: "galeri", yol: "@galeri", bekle: "body" },
  { ad: "yasal-kvkk", yol: "/yasal/kvkk", bekle: "body" },
  { ad: "yasal-gizlilik", yol: "/yasal/gizlilik", bekle: "body" },
  { ad: "yasal-mesafeli", yol: "/yasal/mesafeli-satis", bekle: "body" },
  { ad: "yasal-iade", yol: "/yasal/iade-iptal", bekle: "body" },
  { ad: "yasal-cerez", yol: "/yasal/cerez", bekle: "body" },
];

/* ═════ 1) TÜM SAYFALAR × 3 DİL × 2 EKRAN ═════ */
for (const ek of EKRAN) {
  for (const dil of DILLER) {
    const ctx = await browser.newContext({
      viewport: { width: ek.w, height: ek.h },
      isMobile: ek.mobil, hasTouch: ek.mobil,
    });
    /* Ödeme sayfası boş sepette yönlendirebilir — dolu sepetle gir. */
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { smooky: { qty: 1, note: "" } } }));
        localStorage.setItem("mag:sound", "0");
      } catch { /* yok say */ }
    });
    const p = await ctx.newPage();
    const jsHatalari = [];
    p.on("pageerror", (e) => jsHatalari.push(e.message));

    for (const sf of SAYFALAR) {
      /* "@galeri" = dile göre yerelleşmiş slug */
      const url = sf.yol === "@galeri" ? base + dil.galeri : base + dil.on + sf.yol;
      let durum = 0;
      const r = await p.goto(url, { waitUntil: "load" }).catch(() => null);
      durum = r?.status() ?? 0;
      await p.waitForSelector(sf.bekle, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(700);

      const govde = ((await p.textContent("body").catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
      /* Sayfa gerçekten dolu mu ve hata ekranı değil mi */
      const hataEkrani = /404|500|Bu sayfa bulunamadı|Application error|Internal Server Error/i.test(govde.slice(0, 400));
      const yerTutucu = /\{\{[A-ZİĞÜŞÖÇ_]+\}\}/.test(govde);
      check(
        `${ek.ad} ${dil.kod} ${sf.ad}`,
        durum === 200 && govde.length > 200 && !hataEkrani && !yerTutucu,
        `HTTP ${durum} · ${govde.length} karakter${hataEkrani ? " · HATA EKRANI" : ""}${yerTutucu ? " · YER TUTUCU" : ""}`,
      );
      await p.screenshot({ path: `${out}/${ek.ad}-${dil.kod}-${sf.ad}.png`, fullPage: sf.ad.startsWith("yasal") });
    }
    /* İLETİŞİM KATMANI: ayrı sayfa değil, düğmeyle açılıyor. */
    await p.goto(base + dil.on + "/", { waitUntil: "load" });
    await p.waitForTimeout(800);
    const acKm = p.locator("[data-contact-open]").first();
    if (await acKm.count()) {
      await acKm.click();
      const acildi = await p.waitForSelector('.contact[data-state="open"]', { timeout: 10000 }).then(() => true).catch(() => false);
      await p.waitForTimeout(900);
      const km = ((await p.textContent(".contact").catch(() => "")) ?? "").replace(/\s+/g, " ");
      check(`${ek.ad} ${dil.kod} iletisim (katman)`, acildi && km.length > 100, `${km.length} karakter`);
      await p.screenshot({ path: `${out}/${ek.ad}-${dil.kod}-iletisim.png` });
    } else {
      check(`${ek.ad} ${dil.kod} iletisim (katman)`, false, "açma düğmesi yok");
    }
    check(`${ek.ad} ${dil.kod}: sayfa JS hatası yok`, jsHatalari.length === 0, jsHatalari.slice(0, 2).join(" | ") || "temiz");
    await ctx.close();
  }
}

/* ═════ 2) WhatsApp AKIŞI — kurye ve gel-al ═════
   Buton gerçekten tıklanır (normal akış) ama wa.me AÇILMAZ: window.open
   yamalanıp URL yakalanır. Kurulan siparişlerin kodu sonda raporlanır. */
const kurulanlar = [];
for (const tur of ["delivery", "pickup"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  /* Kurye min sepet eşiğini geçecek kadar ürün */
  await ctx.addInitScript(() => {
    localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { smooky: { qty: 2, note: "" }, kola: { qty: 1, note: "" } } }));
    localStorage.setItem("mag:sound", "0");
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__wa = null; window.open = (u) => { window.__wa = String(u); return null; }; });
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(1500);

  if (tur === "delivery") {
    await p.getByRole("button", { name: "Kurye" }).click();
    await p.waitForSelector("select[aria-label=Mahalle]", { timeout: 8000 });
    await p.selectOption("select[aria-label=Mahalle]", "merkez");
    await p.fill("textarea", "Cumhuriyet Mah. Smoke Sk. No:1");
  } else {
    await p.getByRole("button", { name: "Gel-al" }).click();
  }
  await p.fill("input[placeholder='Ad soyad']", "Smoke Test");
  await p.fill("input[placeholder='05XX XXX XX XX']", "0532 123 45 67");
  await p.locator("[data-terms-check]").check();
  await p.waitForTimeout(400);

  const buton = p.locator("button", { hasText: /WhatsApp/i }).first();
  check(`whatsapp ${tur}: buton açık`, await buton.isEnabled());
  await buton.click();
  await p.waitForTimeout(4000);

  const wa = await p.evaluate(() => window.__wa);
  check(`whatsapp ${tur}: wa.me açıldı (gönderilmedi)`, !!wa && wa.startsWith("https://wa.me/"), wa ? wa.slice(0, 48) + "…" : "YOK");
  if (wa) {
    const metin = decodeURIComponent(new URL(wa).searchParams.get("text") ?? "");
    check(`whatsapp ${tur}: mesaj başlığı`, metin.startsWith("MAG STREET FOOD"), metin.split("\n")[0]);
    const feeSatiri = /Teslimat ücreti: (\d+) TL/.exec(metin);
    if (tur === "delivery") {
      check("whatsapp kurye: teslimat ücreti satırı var", !!feeSatiri, feeSatiri?.[0] ?? "YOK");
      const ara = Number(/Ara toplam: (\d+)/.exec(metin)?.[1] ?? 0);
      const fee = Number(feeSatiri?.[1] ?? 0);
      const top = Number(/TOPLAM: (\d+)/.exec(metin)?.[1] ?? 0);
      check("whatsapp kurye: toplam doğru", ara + fee === top, `${ara} + ${fee} = ${ara + fee} · mesajda ${top}`);
    } else {
      check("whatsapp gel-al: teslimat satırı YOK", !feeSatiri, feeSatiri?.[0] ?? "yok (doğru)");
    }
  }
  const kutu = (await p.locator("[data-wa-done]").textContent().catch(() => "")) ?? "";
  const kod = kutu.match(/#([A-HJ-NP-Z2-9]{6})/)?.[1] ?? null;
  check(`whatsapp ${tur}: sipariş no ekranda`, !!kod, kod ?? "görünmüyor");
  if (kod) kurulanlar.push(kod);
  await p.screenshot({ path: `${out}/whatsapp-${tur}.png`, fullPage: true });
  await ctx.close();
}

/* ═════ 3) PANEL — yalnız GÖRÜNTÜLEME ═════ */
if (!PANEL) {
  console.log("ATLA panel: PANEL_KEY bulunamadı");
} else {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  await p.goto(base + "/panel", { waitUntil: "load" });
  await p.fill("form input[type=password]", PANEL);
  await p.click("form button[type=submit]");
  const girdi = await p.waitForSelector(".tabs", { timeout: 15000 }).then(() => true).catch(() => false);
  check("panel: giriş yapıldı", girdi);

  if (girdi) {
    await p.screenshot({ path: `${out}/panel-1-giris.png` });
    /* Raporlar sekmesi — yalnız görüntüle */
    const rap = p.locator(".tabs button, .tabs a").filter({ hasText: /Rapor/i }).first();
    if (await rap.count()) {
      await rap.click();
      await p.waitForTimeout(2500);
      const m = ((await p.textContent("body")) ?? "").replace(/\s+/g, " ");
      check("panel: raporlar açıldı", /Ciro|Sipariş|Rapor/i.test(m));
      await p.screenshot({ path: `${out}/panel-2-raporlar.png`, fullPage: true });
    }
    /* Ayarlar: fiyat + mahalle + servis anahtarları */
    await p.locator(".tabs button, .tabs a").filter({ hasText: "Ayarlar" }).first().click();
    await p.waitForSelector("[data-prices]", { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1200);

    const fiyatSayisi = await p.locator("[data-price-input]").count();
    check("panel: fiyat ekranı doldu", fiyatSayisi > 20, fiyatSayisi + " fiyat alanı");
    await p.locator("[data-prices]").screenshot({ path: `${out}/panel-3-fiyatlar.png` }).catch(() => {});

    const mahalleSayisi = await p.locator("[data-zone]").count();
    check("panel: mahalle ekranı doldu", mahalleSayisi > 0, mahalleSayisi + " mahalle satırı");

    /* Servis anahtarlarının KENDİ kancaları var; metne göre aramak yanıltıcıydı
       (buton etiketleri duruma göre değişiyor). Yalnız GÖRÜNÜRLÜK sınanır —
       tıklanmaz, canlı ayar değiştirilmez. */
    const anahtarlar = await p.locator("[data-ordering-toggle], [data-delivery-toggle], [data-pickup-toggle]").count();
    check("panel: servis anahtarları görünüyor", anahtarlar === 3, anahtarlar + "/3 anahtar");
    const ozet = ((await p.locator("[data-svc-summary]").textContent().catch(() => "")) ?? "").trim();
    check("panel: servis durumu özeti var", ozet.length > 0, ozet.slice(0, 50));
    await p.screenshot({ path: `${out}/panel-4-ayarlar.png`, fullPage: true });
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${fail ? fail + " DÜŞEN" : "hepsi geçti"}`);
if (bozuk.length) { console.log("\nBOZUK OLANLAR:"); for (const b of bozuk) console.log("  · " + b); }
if (kurulanlar.length) console.log(`\nTEMİZLENECEK canlı sipariş kodu: ${kurulanlar.join(", ")}`);
console.log(`kareler: ${out}/`);
process.exit(fail ? 1 : 0);
