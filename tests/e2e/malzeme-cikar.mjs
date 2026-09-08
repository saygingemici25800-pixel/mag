// Malzeme çıkarma — uçtan uca:
//  - ürün sheet'inde ve sepet satırında malzeme çıkarma / geri alma
//  - çıkarılamaz malzemeler (ana protein + ekmek) pasif, "çıkarılamaz" notlu
//  - aynı üründen sade ve çıkarılmış iki adet AYRI satır; adet kontrolü doğru satıra işler
//  - bilgi ödeme özetine ve panele taşınır ("Çıkarılan: ...")
//  - FİYAT DEĞİŞMEZ
//  - erişilebilirlik: çipler <button>, aria-pressed doğru, ekran okuyucu durumu okur
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { seedCart, fillDelivery, FAKE_NOW } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
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
await p.locator("[data-ing-open]").click();
await p.waitForSelector("[data-ing-picker]", { timeout: 5000 });

const chips = await p.evaluate(() => [...document.querySelectorAll("[data-ing-picker] [data-ing]")].map((c) => ({
  name: c.dataset.ing, removable: c.dataset.removable === "true", disabled: c.disabled,
  pressed: c.getAttribute("aria-pressed"), label: c.getAttribute("aria-label"), tag: c.tagName,
  h: Math.round(c.getBoundingClientRect().height),
})));
check("malzemeler çip olarak listelendi", chips.length >= 5, `${chips.length} malzeme`);
check("her çip bir <button>", chips.every((c) => c.tag === "BUTTON"));
const fixed = chips.filter((c) => !c.removable);
check("çıkarılamazlar pasif (disabled)", fixed.length >= 2 && fixed.every((c) => c.disabled), fixed.map((c) => c.name).join(", "));
check("çıkarılamazlarda 'çıkarılamaz' notu", fixed.every((c) => /çıkarılamaz/.test(c.label ?? "")));
check("çıkarılabilirlerde aria-pressed=false", chips.filter((c) => c.removable).every((c) => c.pressed === "false"));

/* çıkar → üstü çizili + aria-pressed=true */
const target = chips.find((c) => c.removable).name;
await p.locator(`[data-ing="${target}"]`).click();
await p.waitForTimeout(300);
const after = await p.evaluate((n) => {
  const c = document.querySelector(`[data-ing="${n}"]`);
  return { pressed: c.getAttribute("aria-pressed"), line: getComputedStyle(c.querySelector(".ingname")).textDecorationLine, label: c.getAttribute("aria-label"), summary: document.querySelector(".sheet [data-removed]")?.textContent?.trim() };
}, target);
check("çıkarınca aria-pressed=true", after.pressed === "true");
check("çıkarınca üstü çizili", /line-through/.test(after.line), after.line);
check("ekran okuyucu durumu okur ('… çıkarıldı')", /çıkarıldı/.test(after.label ?? ""), after.label);
check("sheet'te özet görünür", /Çıkarılan/.test(after.summary ?? "") && after.summary.includes(target), after.summary);
/* geri al */
await p.locator(`[data-ing="${target}"]`).click();
await p.waitForTimeout(300);
check("tekrar tıklayınca geri gelir", (await p.getAttribute(`[data-ing="${target}"]`, "aria-pressed")) === "false");
/* tekrar çıkar ve sepete ekle */
await p.locator(`[data-ing="${target}"]`).click();
await p.waitForTimeout(200);
await p.screenshot({ path: `${out}/1440-sheet.png` });
await p.getByRole("button", { name: /Sepete ekle/ }).click();
/* sheet uçuş animasyonundan sonra kapanır; kapanmadan ikinci kez açmaya çalışma */
await p.waitForSelector(".sheet", { state: "detached", timeout: 8000 });
await p.waitForTimeout(600);

/* ---------- 2) aynı üründen SADE bir adet daha (seçim sıfırlanmış olmalı) ---------- */
await p.locator("[data-pcard]").first().click();
await p.waitForSelector(".sheet", { timeout: 8000 });
check("sheet yeniden açılınca malzeme seçimi sıfırlanır", (await p.locator(".sheet [data-removed]").count()) === 0);
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

/* sepet satırından düzenleme: bağlantı yazısı "Malzemeleri düzenle" olmalı */
const editLabel = await p.locator(`[data-line-key="${variantKey}"]:visible [data-ing-open]`).first().textContent();
check("çıkarılmış satırda yazı 'Malzemeleri düzenle'", /düzenle/i.test(editLabel ?? ""), editLabel?.trim());
const plainLabel = await p.locator(`[data-line-key="${plainKey}"]:visible [data-ing-open]`).first().textContent();
check("sade satırda yazı 'Malzeme çıkar'", /Malzeme çıkar/i.test(plainLabel ?? ""), plainLabel?.trim());

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
check("panelde yüksek kontrast (limon)", panelRemoved?.color === "rgb(255, 214, 98)", panelRemoved?.color);
await panel.screenshot({ path: `${out}/1440-panel.png` });
await panelCtx.close();
await ctx.close();

/* ---------- 5) mobil: dokunma alanı ≥44px ---------- */
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await seedCart(mctx, { smooky: 1 });
const mp = await mctx.newPage();
await mp.goto(base + "/siparis/odeme", { waitUntil: "load" });
await mp.waitForFunction(() => [...document.querySelectorAll("[data-cart-line]")].some((l) => l.getBoundingClientRect().height > 0), null, { timeout: 15000 });
await mp.locator("[data-cart-line]:visible [data-ing-open]").first().click();
await mp.waitForSelector("[data-ing-picker]", { timeout: 5000 });
/* Özet iki kez render edilir; gizli kopyanın çipleri 0 px ölçülür — yalnızca GÖRÜNÜR olanlara bak. */
const chipHeights = await mp.evaluate(() =>
  [...document.querySelectorAll("[data-ing-picker] [data-ing]")].map((c) => c.getBoundingClientRect().height).filter((h) => h > 0),
);
const small = chipHeights.filter((h) => h < 44).length;
check("mobil: çip yüksekliği ≥44 px", small === 0 && chipHeights.length > 0, `${chipHeights.length} çip, en küçük ${Math.min(...chipHeights)} px`);
await mp.screenshot({ path: `${out}/390-secici.png` });
await mctx.close();

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
