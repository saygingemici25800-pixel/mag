// "YANINDA İYİ GİDER" — sepet özetinin altındaki öneri bölümü:
//  - ekleme: "+ Ekle" → sepete girer, cartFx uçuşu tetiklenir, çubuk ve toplam anında güncellenir
//  - sepette olan ürün "+ Ekle" yerine adet kontrolü (− n +) gösterir; artırma toplamı büyütür
//  - hem /siparis hem /siparis/odeme özet kartının altında görünür
//  - boş sepette bölüm hiç görünmez
//  - mobilde tek satır yatay kaydırma, masaüstünde 4'lü ızgara
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CART_KEY, seedCart, clearCart } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

/* ---- statik: veri ve AÇIK notları ---- */
const menu = readFileSync(path.join(root, "lib/menu.ts"), "utf8");
const WANTED = [
  ["ayran", "Ayran"], ["salgam", "Şalgam"], ["kola", "Kola"], ["limonata", "Limonata"],
  ["patates", "Patates"], ["sogan-halkasi", "Soğan halkası"], ["ekstra-cheddar-sos", "Ekstra cheddar sos"], ["tutsu-biberli-aioli", "Tütsü biberli aioli"],
];
check("UPSELL_IDS sekiz ürünü listeler", WANTED.every(([id]) => new RegExp(`"${id}"`).test(menu.match(/UPSELL_IDS = \[[^\]]+\]/)?.[0] ?? "")), WANTED.map(([id]) => id).join(" "));
/* yeni eklenen placeholder'ların yanında AÇIK notu olmalı (mevcut ürünlerde zaten fiyat teyitli) */
for (const id of ["salgam", "kola", "limonata", "sogan-halkasi", "ekstra-cheddar-sos", "tutsu-biberli-aioli"]) {
  const line = menu.split("\n").find((l) => l.includes(`id: "${id}"`)) ?? "";
  check(`${id}: satırında AÇIK notu var`, /AÇIK/.test(line), line.trim().slice(0, 110));
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));

/* CheckoutPage özeti hem mobil hem masaüstü sütununda render edilir (biri gizli): GÖRÜNÜR olanı al */
const visibleUpsell = () => {
  const all = [...document.querySelectorAll("[data-upsell]")];
  return all.find((el) => el.getBoundingClientRect().height > 0) ?? null;
};
const upsellState = () => p.evaluate(() => {
  const all = [...document.querySelectorAll("[data-upsell]")];
  const s = all.find((el) => el.getBoundingClientRect().height > 0) ?? null;
  if (!s) return { exists: all.length > 0, visible: false, hidden: all.length };
  const cards = [...s.querySelectorAll("[data-upsell-item]")];
  const list = s.querySelector(".upsell-list");
  return {
    exists: true,
    visible: true,
    title: s.querySelector(".upsell-h")?.textContent?.trim(),
    titleFont: getComputedStyle(s.querySelector(".upsell-h")).fontFamily.split(",")[0].replace(/"/g, ""),
    nameFont: getComputedStyle(s.querySelector(".upsell-name")).fontFamily.split(",")[0].replace(/"/g, ""),
    priceColor: getComputedStyle(s.querySelector(".upsell-price")).color,
    count: cards.length,
    ids: cards.map((c) => c.dataset.upsellItem),
    withAdd: cards.filter((c) => c.querySelector("[data-upsell-add]")).map((c) => c.dataset.upsellItem),
    withQty: cards.filter((c) => c.querySelector("[data-upsell-qty]")).map((c) => c.dataset.upsellItem),
    display: getComputedStyle(list).display,
    cols: getComputedStyle(list).gridTemplateColumns.split(" ").length,
    overflowX: getComputedStyle(list).overflowX,
    hasImages: cards.every((c) => !!c.querySelector(".pimg")),
  };
});
const total = () => p.evaluate(() => {
  const el = document.querySelector("[data-cart-total]") ?? document.querySelector("[data-cart-totals] .font-bold span:last-child");
  return el ? el.textContent.trim() : "";
});

/* ---- boş sepet: bölüm görünmez ---- */
await p.goto(base + "/siparis", { waitUntil: "load" });
await clearCart(p);
await p.reload({ waitUntil: "load" });
await p.waitForSelector(".pcard", { timeout: 10000 });
check("boş sepette bölüm görünmez (/siparis)", !(await upsellState()).exists);
await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
await p.waitForTimeout(700);
check("boş sepette bölüm görünmez (/siparis/odeme)", !(await upsellState()).exists);

/* ---- dolu sepet: /siparis ---- */
await seedCart(ctx, { smooky: 1 });
await p.goto(base + "/siparis", { waitUntil: "load" });
await p.waitForSelector("[data-upsell]", { timeout: 10000 });
let s = await upsellState();
check("/siparis: bölüm görünür", s.exists && s.visible);
check("başlık 'YANINDA İYİ GİDER', Comico", s.title === "YANINDA İYİ GİDER" && s.titleFont === "Comico", `${s.title} · ${s.titleFont}`);
check("ürün adı Bonny, fiyat limon", s.nameFont === "Bonny" && s.priceColor === "rgb(255, 214, 98)", `${s.nameFont} · ${s.priceColor}`);
check("sekiz öneri kartı, her birinde görsel/rozet", s.count === 8 && s.hasImages, `${s.count} kart`);
check("sepette olmayan ürünlerde '+ Ekle'", s.withAdd.length === 8 && s.withQty.length === 0, `ekle=${s.withAdd.length} adet=${s.withQty.length}`);
check("masaüstünde 4'lü ızgara", s.display === "grid" && s.cols === 4, `${s.display} · ${s.cols} sütun`);

/* ---- ekleme: cartFx + çubuk + toplam ---- */
const before = await p.evaluate(() => JSON.parse(localStorage.getItem("mag:cart") ?? "{}").lines ?? {});
const barBefore = await p.textContent(".cb-total [data-cart-total]").catch(() => null);
await p.locator('[data-upsell]:visible [data-upsell-item="kola"] [data-upsell-add]').first().click();
/* uçuş animasyonu: kopya öğe DOM'a girer (reduced-motion kapalı) */
const flew = await p.waitForSelector(".cartfx-copy", { timeout: 1500 }).then(() => true).catch(() => false);
await p.waitForTimeout(1200);
const after = await p.evaluate(() => JSON.parse(localStorage.getItem("mag:cart") ?? "{}").lines ?? {});
check("ekleme sepete yazıldı", (after.kola?.qty ?? 0) === 1 && !before.kola, JSON.stringify(after.kola ?? null));
check("cartFx uçuş animasyonu tetiklendi", flew);
const barAfter = await p.textContent(".cb-total [data-cart-total]").catch(() => null);
check("sepet çubuğu toplamı güncellendi", barBefore !== barAfter && !!barAfter, `${barBefore} → ${barAfter}`);
s = await upsellState();
check("eklenen üründe artık adet kontrolü var", s.withQty.includes("kola") && !s.withAdd.includes("kola"), `adet=${s.withQty.join(",")}`);

/* ---- adet artırma ---- */
await p.locator('[data-upsell]:visible [data-upsell-item="kola"] [data-upsell-qty] button:last-child').first().click();
await p.waitForTimeout(500);
const q2 = await p.locator('[data-upsell]:visible [data-upsell-item="kola"] [data-upsell-qty] b').first().textContent();
check("adet artırma çalışır", q2.trim() === "2", `adet=${q2.trim()}`);
const barQ2 = await p.textContent(".cb-total [data-cart-total]").catch(() => null);
check("artırma toplamı güncelledi", barQ2 !== barAfter, `${barAfter} → ${barQ2}`);
/* azaltma */
await p.locator('[data-upsell]:visible [data-upsell-item="kola"] [data-upsell-qty] button:first-child').first().click();
await p.waitForTimeout(400);
check("azaltma çalışır", (await p.locator('[data-upsell]:visible [data-upsell-item="kola"] [data-upsell-qty] b').first().textContent()).trim() === "1");

/* ---- /siparis/odeme: özet kartının altında ---- */
await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
await p.waitForFunction(() => [...document.querySelectorAll("[data-upsell]")].some((el) => el.getBoundingClientRect().height > 0), null, { timeout: 10000 });
s = await upsellState();
check("/siparis/odeme: bölüm görünür", s.exists && s.visible);
const order = await p.evaluate(() => {
  const ups = [...document.querySelectorAll("[data-upsell]")].filter((el) => el.getBoundingClientRect().height > 0);
  const up = ups[0];
  const sum = up.previousElementSibling;
  return { below: up.getBoundingClientRect().top >= sum.getBoundingClientRect().top, sameCol: sum.classList.contains("cartpane2"), visibleCount: ups.length };
});
check("özet kartının ALTINDA (tek görünür kopya)", order.below && order.sameCol && order.visibleCount === 1, JSON.stringify(order));
const tBefore = await total();
await p.locator('[data-upsell]:visible [data-upsell-item="limonata"] [data-upsell-add]').first().click();
await p.waitForTimeout(1200);
const tAfter = await total();
check("ödeme sayfasında ekleme toplamı günceller", tBefore !== tAfter && !!tAfter, `${tBefore} → ${tAfter}`);

/* ---- mobil: tek satır yatay kaydırma ---- */
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await seedCart(mctx, { smooky: 1 });
await mp.goto(base + "/siparis/odeme", { waitUntil: "load" });
await mp.waitForFunction(() => [...document.querySelectorAll("[data-upsell]")].some((el) => el.getBoundingClientRect().height > 0), null, { timeout: 10000 });
const m = await mp.evaluate(() => {
  const up = [...document.querySelectorAll("[data-upsell]")].find((el) => el.getBoundingClientRect().height > 0);
  const list = up.querySelector(".upsell-list"), cards = [...up.querySelectorAll("[data-upsell-item]")];
  const tops = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)));
  return { display: getComputedStyle(list).display, overflowX: getComputedStyle(list).overflowX, rows: tops.size, scrollable: list.scrollWidth > list.clientWidth + 4 };
});
check("mobil: tek satır (flex), yatay kaydırma", m.display === "flex" && m.overflowX === "auto" && m.rows === 1 && m.scrollable, JSON.stringify(m));
await mp.close();
await mctx.close();

/* ---- sepet boşalınca bölüm kaybolur ---- */
await clearCart(p);
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(900);
check("sepet boşalınca bölüm kaybolur", !(await upsellState()).exists);
void visibleUpsell;
void CART_KEY;

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
