// Malzeme çıkarma — uçtan uca:
//  - ürün sheet'inde ve sepet satırında malzeme çıkarma / geri alma
//  - çıkarılamaz malzemeler (ana protein + ekmek) pasif, "çıkarılamaz" notlu
//  - aynı üründen sade ve çıkarılmış iki adet AYRI satır; adet kontrolü doğru satıra işler
//  - bilgi ödeme özetine ve panele taşınır ("Çıkarılan: ...")
//  - FİYAT DEĞİŞMEZ
//  - erişilebilirlik: gerçek <input type=checkbox>, Tab+Space çalışır, ekran okuyucu durumu okur
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { seedCart, fillDelivery, FAKE_NOW } from "./_cart-fixture.mjs";
import { guard } from "../../scripts/test-guard.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
/* canlı veritabanına test yazmayı engeller (scripts/test-guard.mjs) */
await guard(base);
const out = process.argv[3] ?? "docs/screens/malzeme";
const root = process.argv[4] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
const KEY = process.env.PANEL_KEY ?? "test1234";
mkdirSync(out, { recursive: true });
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik: malzemeler menü verisinde, ikinci liste yok ---- */
const menu = readFileSync(path.join(root, "lib/menu.ts"), "utf8");
check("menu.ts'te ingredients alanı var", /ingredients\?: Ingredient\[\]/.test(menu));
check("Ingredient tipinde removable var", /removable: boolean/.test(menu));
const smookyIngs = menu.match(/id: "smooky"[\s\S]{0,900}?ingredients: \[(.*?)\],\n/)?.[1] ?? "";
check("SMOOKY malzemeleri veride", /füme kaburga/.test(smookyIngs) && /karamelize soğan/.test(smookyIngs) && /iceberg marul/.test(smookyIngs), smookyIngs.slice(0, 80));
check("SMOOKY köftesi çıkarılamaz", /130 gr burger köftesi", removable: false/.test(smookyIngs));
check("SMOOKY ekmeği çıkarılamaz", /ekmek", removable: false/.test(smookyIngs));

const b = await chromium.launch();

/* ---------- 1) ürün sheet'inde çıkarma (sepete eklemeden önce) ---------- */
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await p.goto(base + "/siparis", { waitUntil: "load" });
await p.waitForSelector(".pcard", { timeout: 15000 });
await p.locator('[data-pcard][data-k="smooky"], [data-pcard]').first().click();
await p.waitForSelector(".sheet", { timeout: 8000 });
/* 16 Eyl 2026: açılır kart kaldırıldı — liste HER ZAMAN AÇIK, tıklama gerekmiyor. */
await p.waitForSelector("[data-ing-list]", { timeout: 5000 });

const rows = await p.evaluate(() => [...document.querySelectorAll("[data-ing-list] .ingrow")].map((r) => ({
  name: r.dataset.ing, removable: r.dataset.removable === "true",
  box: !!r.querySelector(".ingbox"), label: r.querySelector(".ingbox")?.getAttribute("aria-label"),
  h: Math.round(r.getBoundingClientRect().height),
})));
check("malzemeler satır satır listelendi", rows.length >= 5, `${rows.length} satır`);
check("satır yüksekliği 40 px", rows.every((r) => r.h >= 40), rows.map((r) => r.h).join("/"));
const fixed = rows.filter((r) => !r.removable);
check("çıkarılamazlarda kutu YOK", fixed.length >= 2 && fixed.every((r) => !r.box), fixed.map((r) => r.name).join(", "));
check("çıkarılamazlar listenin EN ÜSTÜNDE", rows.slice(0, fixed.length).every((r) => !r.removable), rows.map((r) => (r.removable ? "·" : "F")).join(""));
check("çıkarılabilirlerde onay kutusu var", rows.filter((r) => r.removable).every((r) => r.box));

/* çıkar → üstü çizili + kutu işaretli */
const target = rows.find((r) => r.removable).name;
const row = (n) => p.locator(`.ingrow[data-ing="${n}"] .ingrow-label`).first();
await row(target).click();
await p.waitForTimeout(300);
const after = await p.evaluate((n) => {
  const r = document.querySelector(`.ingrow[data-ing="${n}"]`);
  return { checked: r.querySelector(".ingbox").checked, line: getComputedStyle(r.querySelector(".ingrow-name")).textDecorationLine,
           label: r.querySelector(".ingbox").getAttribute("aria-label"),
           title: document.querySelector("[data-ing-list] .inglist-title")?.textContent?.trim(),
           summary: document.querySelector(".sheet [data-removed]")?.textContent?.trim() };
}, target);
check("çıkarınca kutu işaretli", after.checked === true);
check("çıkarınca üstü çizili", /line-through/.test(after.line), after.line);
check("ekran okuyucu durumu okur ('… çıkarıldı')", /çıkarıldı/.test(after.label ?? ""), after.label);
check("başlıkta sayaç: 'Malzeme çıkar (1)'", /\(1\)/.test(after.title ?? ""), after.title);
/* geri al */
await row(target).click();
await p.waitForTimeout(300);
check("tekrar tıklayınca geri gelir", (await p.evaluate((n) => document.querySelector(`.ingrow[data-ing="${n}"] .ingbox`).checked, target)) === false);
check("sayaç 0'da başlık sade", !/\(\d+\)/.test(await p.locator("[data-ing-list] .inglist-title").first().textContent()));
/* tekrar çıkar ve sepete ekle */
await row(target).click();
await p.waitForTimeout(200);
await p.screenshot({ path: `${out}/1440-sheet.png` });
await p.getByRole("button", { name: /Sepete ekle/ }).click();
/* sheet uçuş animasyonundan sonra kapanır; kapanmadan ikinci kez açmaya çalışma */
await p.waitForSelector(".sheet", { state: "detached", timeout: 8000 });
await p.waitForTimeout(600);

/* ---------- 2) aynı üründen SADE bir adet daha (seçim sıfırlanmış olmalı) ---------- */
await p.locator("[data-pcard]").first().click();
await p.waitForSelector(".sheet", { timeout: 8000 });
check("sheet yeniden açılınca malzeme seçimi sıfırlanır", (await p.locator(".sheet .ingbox:checked").count()) === 0);
await p.getByRole("button", { name: /Sepete ekle/ }).click();
await p.waitForSelector(".sheet", { state: "detached", timeout: 8000 });
await p.waitForTimeout(600);

const cart = await p.evaluate(() => JSON.parse(localStorage.getItem("mag:cart") ?? "{}").lines ?? {});
const keys = Object.keys(cart);
check("iki AYRI satır oluştu (sade + çıkarılmış)", keys.length === 2, keys.join(" · "));
check("satır kimliği çıkarılanlardan türedi", keys.some((k) => k.includes("::")) && keys.some((k) => !k.includes("::")), keys.join(" · "));
const variantKey = keys.find((k) => k.includes("::"));
check("çıkarılan malzeme satırda saklı", (cart[variantKey].removed ?? []).includes(target), JSON.stringify(cart[variantKey].removed));

/* ---------- 3) ödeme özeti: bilgi taşınıyor, fiyat değişmiyor ---------- */
await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
/* özet iki kez render edilir (mobil + masaüstü sütunu); GÖRÜNÜR olanları al */
await p.waitForFunction(() => [...document.querySelectorAll("[data-cart-line]")].some((l) => l.getBoundingClientRect().height > 0), null, { timeout: 15000 });
const lines = await p.evaluate(() => [...document.querySelectorAll("[data-cart-line]")].filter((l) => l.getBoundingClientRect().height > 0).map((l) => ({
  key: l.dataset.lineKey, removed: l.querySelector("[data-removed]")?.textContent?.trim() ?? "",
  price: l.querySelector(".font-display")?.textContent?.trim() ?? "", qty: l.querySelector(".qty b")?.textContent?.trim(),
})));
check("ödeme özetinde iki satır", lines.length === 2, lines.map((l) => l.key).join(" · "));
const withRemoved = lines.find((l) => l.removed);
check("özette 'Çıkarılan: …' görünüyor", /Çıkarılan/.test(withRemoved?.removed ?? "") && withRemoved.removed.includes(target), withRemoved?.removed);
const prices = lines.map((l) => l.price);
check("FİYAT DEĞİŞMEDİ (iki satır aynı birim fiyat)", prices[0] === prices[1], prices.join(" vs "));

/* adet kontrolü doğru satıra işler */
const beforeQty = await p.evaluate((k) => JSON.parse(localStorage.getItem("mag:cart")).lines[k].qty, variantKey);
await p.locator(`[data-line-key="${variantKey}"]:visible .qty button`).last().click();
await p.waitForTimeout(500);
const afterCart = await p.evaluate(() => JSON.parse(localStorage.getItem("mag:cart")).lines);
const plainKey = keys.find((k) => !k.includes("::"));
check("adet artırma yalnızca o satıra işledi", afterCart[variantKey].qty === beforeQty + 1 && afterCart[plainKey].qty === cart[plainKey].qty,
  `varyant ${cart[variantKey].qty}→${afterCart[variantKey].qty}, sade ${cart[plainKey].qty}→${afterCart[plainKey].qty}`);
await p.screenshot({ path: `${out}/1440-odeme.png` });

/* 16 Eyl 2026: "Malzemeleri düzenle" bağlantısı YOK — liste her satırda hep açık.
   Ayrım artık başlıktaki sayaçta: çıkarılmış satırda "(n)", sade satırda yok. */
const editLabel = await p.locator(`[data-line-key="${variantKey}"]:visible .inglist-title`).first().textContent();
check("çıkarılmış satırın başlığında sayaç var", /\(\d+\)/.test(editLabel ?? ""), editLabel?.trim());
const plainLabel = await p.locator(`[data-line-key="${plainKey}"]:visible .inglist-title`).first().textContent();
check("sade satırda sayaç yok", !/\(\d+\)/.test(plainLabel ?? ""), plainLabel?.trim());
check("her sepet satırında liste AÇIK (tıklama gerekmiyor)", (await p.locator("[data-cart-line]:visible [data-ing-list]").count()) >= 2);

/* ---------- 4) sipariş ver → panelde "Çıkarılan" görünüyor mu ---------- */
await p.clock.install({ time: FAKE_NOW }).catch(() => {});
await fillDelivery(p, { zone: "merkez", address: "Malzeme Test Sk. No:3", name: "Malzeme Test", phone: "05327778899" });
await p.click('button[type="submit"]');
await p.waitForURL(/\/odeme\/test/, { timeout: 30000 });
await p.getByRole("button", { name: "Ödemeyi tamamla" }).click();
await p.waitForURL(/\/siparis\/[0-9a-f-]{36}/, { timeout: 40000 });
const orderId = p.url().split("/siparis/")[1].split("?")[0];

const panelCtx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const panel = await panelCtx.newPage();
await panel.goto(base + "/panel", { waitUntil: "load" });
await panel.fill("form input[type=password]", KEY);
await panel.click("form button[type=submit]");
await panel.waitForSelector(".tabs", { timeout: 15000 });
await panel.waitForSelector(`.ocard[data-id="${orderId}"]`, { timeout: 25000 });
const panelRemoved = await panel.evaluate((id) => {
  const card = document.querySelector(`.ocard[data-id="${id}"]`);
  const el = card.querySelector("[data-removed]");
  return el ? { text: el.textContent.trim(), color: getComputedStyle(el).color } : null;
}, orderId);
check("panelde 'Çıkarılan: …' görünüyor", /Çıkarılan/.test(panelRemoved?.text ?? "") && panelRemoved.text.includes(target), panelRemoved?.text);
/* 12 Eyl 2026: palet kırmızı/sarı/gri — vurgu rengi sarı #FDD20E */
check("panelde yüksek kontrast (sarı)", panelRemoved?.color === "rgb(253, 210, 14)", panelRemoved?.color);
await panel.screenshot({ path: `${out}/1440-panel.png` });
await panelCtx.close();
await ctx.close();

/* ---------- 5) mobil: satır dokunma alanı ve taşma ---------- */
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await seedCart(mctx, { smooky: 1 });
const mp = await mctx.newPage();
await mp.goto(base + "/siparis/odeme", { waitUntil: "load" });
await mp.waitForFunction(() => [...document.querySelectorAll("[data-cart-line]")].some((l) => l.getBoundingClientRect().height > 0), null, { timeout: 15000 });
/* Liste her zaman açık — tıklamaya gerek yok.
   Özet iki kez render edilir; gizli kopya 0 px ölçülür, yalnız GÖRÜNÜR olanlara bak. */
await mp.waitForSelector("[data-ing-list]", { timeout: 5000 });
const rowHeights = await mp.evaluate(() =>
  [...document.querySelectorAll("[data-ing-list] .ingrow-label")].map((c) => c.getBoundingClientRect().height).filter((h) => h > 0),
);
const small = rowHeights.filter((h) => h < 40).length;
check("mobil: satır dokunma alanı ≥40 px", small === 0 && rowHeights.length > 0, `${rowHeights.length} satır, en küçük ${Math.min(...rowHeights)} px`);
/* sepet satırının genişliğini aşmamalı */
const overflow = await mp.evaluate(() => [...document.querySelectorAll("[data-cart-line]")].filter((l) => l.getBoundingClientRect().height > 0)
  .map((l) => { const u = l.querySelector("[data-ing-list]"); return u ? +(u.getBoundingClientRect().right - l.getBoundingClientRect().right).toFixed(1) : 0; }));
check("mobil: yatay taşma yok", overflow.every((x) => x <= 0.5), overflow.join(" / "));
await mp.screenshot({ path: `${out}/390-secici.png` });
await mctx.close();

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
