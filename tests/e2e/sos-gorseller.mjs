/**
 * Sos + limonata görselleri — 22 Eyl 2026.
 *
 * Sorulan: görseller menü / sepet / upsell listesinde TAM görünüyor mu, 404 var
 * mı, TR-EN-RU üçünde de çalışıyor mu.
 *
 * KIRPILMA ÖLÇÜMÜ: "göründü" yetmez. Çizilen görselin (naturalWidth oranına göre
 * hesaplanan) gerçek kutusu .pimg çerçevesini AŞIYOR mu ona bakılır — daha önce
 * dikey şişelerde tam bu taştı ve `overflow:hidden` kesiyordu.
 *
 * Koşma: pnpm test:server çalışırken → node tests/e2e/sos-gorseller.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { FAKE_NOW, assertServerReady, seedCart } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/sos";
mkdirSync(out, { recursive: true });

/* Menüdeki id → beklenen dosya. Eşleştirme tablosunun KODDAKİ karşılığı. */
const BEKLENEN = {
  "truflu-mayonez": "/urun/sos/truf-mayo.webp",
  "jalapeno-sos": "/urun/sos/jalapeno-sos.webp",
  "sweet-chili": "/urun/sos/sweet-chili.webp",
  "mag-sos": "/urun/sos/mag-sos.webp",
  "tutsu-biberli-aioli": "/urun/sos/tutsu-biberli-aioli.webp",
  limonata: "/urun/icecek/limonata.webp",
};

await assertServerReady(base);
const browser = await chromium.launch();
let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};

/* 1) DOSYALAR SUNULUYOR MU (404 yok) */
for (const [id, yol] of Object.entries(BEKLENEN)) {
  const r = await fetch(base + yol);
  check(`dosya sunuluyor: ${id}`, r.ok, `${r.status} ${yol}`);
}

/* 2) MENÜ — üç dilde kart görseli + kırpılma ölçümü */
for (const dil of ["tr", "en", "ru"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.clock.install({ time: FAKE_NOW });
  const yol = dil === "tr" ? "/siparis" : `/${dil}/siparis`;
  await p.goto(base + yol, { waitUntil: "load" });
  await p.waitForSelector("article.pcard", { timeout: 15000 });
  /* lazy görseller: sos/içecek kategorisi aşağıda, görünür alana getir */
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);

  for (const [id, dosya] of Object.entries(BEKLENEN)) {
    const ol = await p.evaluate(
      (dosya) => {
        /* kartı id'den değil, görsel src'sinden bul: id DOM'a yazılmıyor */
        const img = [...document.querySelectorAll("article.pcard img")].find((i) =>
          decodeURIComponent(i.currentSrc || i.src).includes(dosya),
        );
        if (!img) return { yok: true };
        const kutu = img.closest(".pimg").getBoundingClientRect();
        const r = img.getBoundingClientRect();
        return {
          yuklendi: img.complete && img.naturalWidth > 0,
          tasma: {
            w: Math.round(r.width - kutu.width),
            h: Math.round(r.height - kutu.height),
          },
          ciz: `${Math.round(r.width)}×${Math.round(r.height)}`,
          kutu: `${Math.round(kutu.width)}×${Math.round(kutu.height)}`,
        };
      },
      dosya,
    );
    if (ol.yok) {
      check(`${dil} menü: ${id}`, false, "kart/görsel bulunamadı");
      continue;
    }
    /* Taşma ≤0 olmalı: görsel kutuyu AŞMAMALI (aşarsa overflow:hidden kırpar). */
    const tam = ol.yuklendi && ol.tasma.w <= 0 && ol.tasma.h <= 0;
    check(`${dil} menü: ${id} tam görünüyor`, tam, `çizim ${ol.ciz} / kutu ${ol.kutu}`);
  }
  await p.screenshot({ path: `${out}/menu-${dil}.png`, fullPage: true });
  await ctx.close();
}

/* 3) SEPET + UPSELL — sosların ikisi sepette, biri upsell'de */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await seedCart(ctx, { "mag-sos": 1, "truflu-mayonez": 2, smooky: 1 });
  const p = await ctx.newPage();
  await p.clock.install({ time: FAKE_NOW });
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(1200);

  for (const id of ["mag-sos", "truflu-mayonez"]) {
    const ol = await p.evaluate((dosya) => {
      const img = [...document.querySelectorAll(".line img")].find((i) =>
        decodeURIComponent(i.currentSrc || i.src).includes(dosya),
      );
      if (!img) return null;
      const kutu = img.closest(".pimg").getBoundingClientRect();
      const r = img.getBoundingClientRect();
      return { yuklendi: img.naturalWidth > 0, dw: Math.round(r.width - kutu.width), dh: Math.round(r.height - kutu.height) };
    }, BEKLENEN[id]);
    check(`sepet satırı: ${id}`, !!ol && ol.yuklendi && ol.dw <= 0 && ol.dh <= 0, ol ? `taşma ${ol.dw}/${ol.dh}` : "bulunamadı");
  }

  /* upsell ("Yanında iyi gider") — limonata ve aioli upsell:true */
  const upsell = await p.evaluate(() => {
    const kok = document.querySelector(".upsell, [data-upsell]");
    if (!kok) return null;
    return [...kok.querySelectorAll("img")].map((i) => decodeURIComponent(i.currentSrc || i.src).split("/urun/")[1]).filter(Boolean);
  });
  check("upsell listesi var", !!upsell, upsell ? upsell.join(", ") : "kök bulunamadı");
  if (upsell) {
    check("upsell'de limonata görseli", upsell.some((u) => u.includes("limonata")), upsell.join(", "));
    check("upsell'de aioli görseli", upsell.some((u) => u.includes("tutsu-biberli-aioli")), upsell.join(", "));
  }
  await p.screenshot({ path: `${out}/sepet-upsell.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
console.log(`kareler: ${out}/`);
process.exit(fail ? 1 : 0);
