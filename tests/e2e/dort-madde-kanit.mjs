/**
 * Dört iş — CANLI durum kanıtı (24 Eyl 2026).
 *
 *   1) Ödeme sayfasında yasal onay kutusu + /yasal/gizlilik
 *   2) Hero: başa dönünce burgerler KAYMAMALI, ışık ortada kalmamalı
 *   3) İletişim yürüme mesafeleri (işletmeden gelen 5 kayıt)
 *   4) citir-tavuk adı her yerde "Çıtır Tavuk & Patates"
 *
 * CANLIDA YALNIZ OKUMA ve normal akış. Yıkıcı senaryo YOK, sipariş kurulmaz
 * (madde 4'ün WhatsApp mesajı yerel sunucudan alınır).
 *
 * Koşma: node tests/e2e/dort-madde-kanit.mjs [taban]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { PANEL_KEY } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "https://magstreetfood.com";
const out = "docs/screens/dort-madde";
mkdirSync(out, { recursive: true });

let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};

const browser = await chromium.launch();

/* ═══ 1) YASAL ONAY + GİZLİLİK ═══ */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  /* Sepet dolu olsun ki ödeme formu görünsün */
  await ctx.addInitScript(() => {
    localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { smooky: { qty: 2, note: "" } } }));
    localStorage.setItem("mag:sound", "0");
  });
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(1500);

  const kutu = p.locator("[data-terms-check]");
  check("1· onay kutusu var", (await kutu.count()) === 1);
  check("1· başlangıçta İŞARETSİZ", !(await kutu.isChecked()));

  const buton = p.locator("button").filter({ hasText: /WhatsApp|Ödeme/i }).first();
  check("1· onaysız buton KİLİTLİ", await buton.isDisabled(), "disabled=" + (await buton.isDisabled()));

  /* Gizlilik bağlantısı ödeme sayfasında */
  const giz = p.locator('a[href*="gizlilik"]');
  check("1· gizlilik bağlantısı var", (await giz.count()) > 0, (await giz.count()) + " bağlantı");
  await p.screenshot({ path: `${out}/1-odeme-onay.png`, fullPage: true });

  /* Onaylayınca açılıyor mu */
  await kutu.check();
  await p.waitForTimeout(400);
  check("1· onaylanınca buton AÇIK", await buton.isEnabled());

  /* Gizlilik sayfası üç dilde dolu mu */
  for (const [dil, yol] of [["tr", "/yasal/gizlilik"], ["en", "/en/yasal/gizlilik"], ["ru", "/ru/yasal/gizlilik"]]) {
    await p.goto(base + yol, { waitUntil: "load" });
    await p.waitForTimeout(500);
    const govde = (await p.textContent("body")) ?? "";
    /* {{TARIH}} gibi doldurulmamış yer tutucu KALMAMALI */
    const yerTutucu = /\{\{[A-ZİĞÜŞÖÇ_]+\}\}/.test(govde);
    check(`1· gizlilik ${dil}: dolu ve yer tutucu yok`, govde.length > 600 && !yerTutucu, `${govde.length} karakter, yerTutucu=${yerTutucu}`);
    if (dil === "tr") await p.screenshot({ path: `${out}/1-gizlilik-tr.png`, fullPage: true });
  }
  await ctx.close();
}

/* ═══ 2) HERO — başa dönünce burgerler kaymamalı, ışık ortada kalmamalı ═══ */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForTimeout(3000);

  /* Sahnedeki burger kutularını ÖLÇ (başlangıç) */
  const olc = () =>
    p.evaluate(() => {
      const el = [...document.querySelectorAll(".stage .item")];
      const isik = document.querySelector(".rays");
      return {
        burgerler: el.map((e) => {
          const r = e.getBoundingClientRect();
          return { t: Math.round(r.top), l: Math.round(r.left) };
        }),
        isik: isik ? (() => { const r = isik.getBoundingClientRect(); return { t: Math.round(r.top), h: Math.round(r.height) }; })() : null,
        heroVH: getComputedStyle(document.documentElement).getPropertyValue("--heroVH").trim(),
      };
    });

  const once = await olc();
  await p.screenshot({ path: `${out}/2-hero-basta.png` });

  /* Aşağı kaydır → başa dön */
  await p.evaluate(() => window.scrollTo(0, 2500));
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(2500);

  const sonra = await olc();
  await p.screenshot({ path: `${out}/2-hero-donunce.png` });

  check("2· sahnede burger bulundu", once.burgerler.length > 0, once.burgerler.length + " öğe");
  if (once.burgerler.length && once.burgerler.length === sonra.burgerler.length) {
    const sapma = once.burgerler.map((b, i) => ({
      dt: Math.abs(sonra.burgerler[i].t - b.t),
      dl: Math.abs(sonra.burgerler[i].l - b.l),
    }));
    const enDikey = Math.max(...sapma.map((s) => s.dt));
    const enYatay = Math.max(...sapma.map((s) => s.dl));
    /* 1px yuvarlama payı; "1 satır aşağı" hatası ~30-56px idi */
    check("2· başa dönünce DİKEY kayma yok", enDikey <= 1, `en büyük sapma ${enDikey}px`);
    check("2· başa dönünce YATAY kayma yok", enYatay <= 1, `en büyük sapma ${enYatay}px`);
    console.log("   ölçüm: " + once.burgerler.map((b, i) => `#${i} ${b.t}→${sonra.burgerler[i].t}`).join("  "));
  }
  check("2· --heroVH donduruldu (değer sabit)", once.heroVH === sonra.heroVH && once.heroVH !== "", `${once.heroVH} → ${sonra.heroVH}`);
  if (once.isik && sonra.isik) {
    check("2· ışık başa dönünce arada kalmadı", Math.abs(sonra.isik.t - once.isik.t) <= 1, `${once.isik.t} → ${sonra.isik.t}`);
    console.log(`   ışık: yükseklik ${once.isik.h}px, üst ${once.isik.t}px`);
  }
  await ctx.close();
}

/* ═══ 3) İLETİŞİM — yürüme mesafeleri ═══
   Mesafeler düz sayfada DEĞİL, açılan iletişim KATMANINDA (.cWalk .cLine).
   Sayfa HTML'inde arama yapmak yanıltıcıydı: çeviri sözlüğü <script> içinde
   ham JSON olarak geçiyor ve "eşleşti" sanılıyordu. */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(base + "/iletisim", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.locator("[data-contact-open]").first().click();
  await p.waitForSelector(".cWalk .cLine", { timeout: 10000 });
  /* Katmanın AÇILMA animasyonu bitsin: data-state="open" olmadan alınan kare
     yarı saydam/kaymış çıkıyor ve kanıt olarak işe yaramıyor. */
  await p.waitForSelector('.contact[data-state="open"]', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1200);

  /* `.cLine` başlık satırını da kapsıyor ("YÜRÜME MESAFESİ"): yalnız <ul> içindeki
     kayıtları al, yoksa sıra bir kayıyor ve liste 5 yerine 6 görünüyor. */
  const satirlar = (await p.locator(".cWalk ul .cLine").allTextContents()).map((x) => x.replace(/\s+/g, " ").trim());
  console.log("   katmandaki liste: " + satirlar.join(" · "));

  /* İşletmeden gelen liste — SIRA da önemli (yakından uzağa) */
  const BEKLENEN = [
    ["Paspatur", "1"],
    ["Balık Pazarı", "3"],
    ["Uğur Mumcu", "4"],
    ["Ece Marina", "4"],
    ["Müzesi", "5"],
  ];
  check("3· tam 5 kayıt", satirlar.length === 5, satirlar.length + " satır");
  BEKLENEN.forEach(([ad, dk], i) => {
    const s2 = satirlar[i] ?? "";
    /* "Sahil4 dk" gibi rakam HARFE bitişik geliyor: \b sınırı tutmuyor.
       Süreyi "<rakam> dk" kalıbıyla ara. */
    check(`3· #${i + 1} ${ad} · ${dk} dk`, s2.includes(ad) && new RegExp(`(^|\\D)${dk}\\s*dk`).test(s2), s2 || "yok");
  });
  await p.screenshot({ path: `${out}/3-iletisim.png` });
  await ctx.close();
}

/* ═══ 4) citir-tavuk ADI — menü + sepet ═══ */
{
  const AD = "Çıtır Tavuk & Patates";
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { "citir-tavuk": { qty: 1, note: "" } } }));
    localStorage.setItem("mag:sound", "0");
  });
  const p = await ctx.newPage();

  /* menü */
  await p.goto(base + "/siparis", { waitUntil: "load" });
  await p.waitForSelector("article.pcard", { timeout: 20000 });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(2000);
  const kart = p.locator("article.pcard").filter({ has: p.locator(".tname", { hasText: AD }) }).first();
  check("4· menüde ad doğru", (await kart.count()) === 1, (await kart.textContent())?.slice(0, 40));
  await kart.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/4-menu.png` });

  /* sepet */
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const satir = ((await p.locator(".line").allTextContents()) ?? []).join(" | ");
  check("4· sepette ad doğru", satir.includes(AD), satir.slice(0, 60));
  await p.screenshot({ path: `${out}/4-sepet.png`, fullPage: true });
  await ctx.close();

  /* WhatsApp MESAJI — YEREL sunucudan. Canlıda sipariş kurmuyoruz (kural:
     canlıda yalnız okuma ve normal akış; test kaydı bırakmayalım). */
  const yerel = process.env.MAG_LOCAL ?? "http://localhost:3112";
  try {
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
    const satir = String(j.message ?? "").split("\n").find((l) => l.includes("Çıtır")) ?? "";
    check("4· WhatsApp mesajında ad doğru (yerel)", satir.includes(AD), satir || JSON.stringify(j.errors ?? j).slice(0, 80));
  } catch (e) {
    check("4· WhatsApp mesajında ad doğru (yerel)", false, "yerel sunucu yok: " + e.message);
  }

  /* PANEL — yalnız OKUMA: menü adını panelin fiyat ekranından doğrula. */
  const KEY = PANEL_KEY; // yerel sunucunun anahtarı (fixture)
  if (KEY) {
    const pctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
    const pp = await pctx.newPage();
    await pp.goto(yerel + "/panel", { waitUntil: "load" });
    await pp.fill("form input[type=password]", KEY);
    await pp.click("form button[type=submit]");
    await pp.waitForSelector(".tabs", { timeout: 10000 });
    await pp.locator(".tabs button, .tabs a").filter({ hasText: "Ayarlar" }).first().click();
    await pp.waitForSelector("[data-prices]", { timeout: 10000 });
    const satir = pp.locator('[data-price-row="citir-tavuk"]');
    await satir.scrollIntoViewIfNeeded();
    const metin = ((await satir.textContent()) ?? "").replace(/\s+/g, " ").trim();
    check("4· panelde ad doğru", metin.includes(AD), metin.slice(0, 60));
    await pp.screenshot({ path: `${out}/4-panel.png` });
    await pctx.close();
  } else {
    console.log("   (PANEL_KEY yok — panel kontrolü atlandı)");
  }
}

await browser.close();
console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
console.log(`kareler: ${out}/`);
process.exit(fail ? 1 : 0);
