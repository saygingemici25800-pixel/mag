/**
 * Teslimat tipi ZORUNLU SEÇİM (25 Eyl 2026).
 *
 * Önceden sayfa "gel-al" seçili açılıyordu; müşteri soruyu görmeden sipariş
 * verebiliyordu. Artık açılışta hiçbiri seçili değil, açık soru sorulur.
 *
 * Koşma: pnpm test:server çalışırken → node tests/e2e/teslimat-tipi.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { FAKE_NOW, PANEL_KEY as KEY, assertServerReady, seedCart } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const out = "docs/screens/teslimat-tipi";
mkdirSync(out, { recursive: true });
await assertServerReady(base);

let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};

const H = { "content-type": "application/json", "x-panel-key": KEY };
const servis = (body) => fetch(base + "/api/panel/settings", { method: "PATCH", headers: H, body: JSON.stringify(body) });

const browser = await chromium.launch();
const yeniSayfa = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await seedCart(ctx, { smooky: 2, kola: 1 });
  const p = await ctx.newPage();
  await p.clock.install({ time: FAKE_NOW });
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForSelector(".seg", { timeout: 15000 });
  await p.waitForTimeout(700);
  return { ctx, p };
};

/* ═══ 1) AÇILIŞ: hiçbir tip seçili değil ═══ */
{
  const { ctx, p } = await yeniSayfa();
  const basili = await p.locator('.seg button[aria-pressed="true"]').count();
  check("açılış: hiçbir tip seçili DEĞİL", basili === 0, basili + " basılı düğme");
  /* `.ord-h` birden çok başlıkta var (sepet özeti de kullanıyor); teslimat
     başlığı .seg'in HEMEN ÖNCEKİ kardeşi — oradan oku. */
  const baslik = ((await p.evaluate(() => document.querySelector(".seg")?.previousElementSibling?.textContent ?? "")) ?? "").trim();
  check("açılış: soru soruluyor", baslik.includes("Nasıl teslim"), baslik);
  check("açılış: gönder butonu KİLİTLİ", await p.locator("[data-wa-submit]").isDisabled());
  check("açılış: 'önce tip seç' uyarısı var", (await p.locator("[data-type-hint]").count()) === 1, ((await p.locator("[data-type-hint]").textContent().catch(() => "")) ?? "").trim());
  check("açılış: mahalle alanı YOK", (await p.locator("select[aria-label=Mahalle]").count()) === 0);
  check("açılış: adres alanı YOK", (await p.locator("textarea").count()) === 0);
  check("açılış: teslimat ücreti satırı YOK", !((await p.locator("[data-cart-totals]").first().textContent()) ?? "").includes("Kurye ücreti"));
  await p.screenshot({ path: `${out}/1-acilis.png`, fullPage: true });
  await ctx.close();
}

/* ═══ 2) KURYE seçilince alanlar açılır, mahalle seçilince ücret görünür ═══ */
{
  const { ctx, p } = await yeniSayfa();
  await p.getByRole("button", { name: "Kurye" }).click();
  await p.waitForTimeout(500);
  check("kurye: düğme basılı", (await p.locator("[data-mode-delivery]").getAttribute("aria-pressed")) === "true");
  check("kurye: mahalle alanı AÇILDI", (await p.locator("select[aria-label=Mahalle]").count()) === 1);
  check("kurye: adres alanı AÇILDI", (await p.locator("textarea").count()) === 1);
  check("kurye: uyarı kalktı", (await p.locator("[data-type-hint]").count()) === 0);

  await p.selectOption("select[aria-label=Mahalle]", "merkez");
  await p.waitForTimeout(600);
  const ozet = ((await p.locator("[data-cart-totals]").first().textContent()) ?? "").replace(/\s+/g, " ");
  check("kurye: mahalle seçilince ÜCRET göründü", /Kurye ücreti/.test(ozet), ozet.slice(0, 80));
  await p.screenshot({ path: `${out}/2-kurye.png`, fullPage: true });

  /* Seçim DEĞİŞTİRİLEBİLİR: gel-al'e geç → alanlar kapanır */
  await p.getByRole("button", { name: "Gel-al" }).click();
  await p.waitForTimeout(600);
  check("gel-al: mahalle alanı KAPANDI", (await p.locator("select[aria-label=Mahalle]").count()) === 0);
  check("gel-al: adres alanı KAPANDI", (await p.locator("textarea").count()) === 0);
  const ozet2 = ((await p.locator("[data-cart-totals]").first().textContent()) ?? "").replace(/\s+/g, " ");
  check("gel-al: ücret satırı YOK", !/Kurye ücreti/.test(ozet2), ozet2.slice(0, 80));
  await p.screenshot({ path: `${out}/3-gel-al.png`, fullPage: true });
  await ctx.close();
}

/* ═══ 3) Tip seçmeden gönderme denemesi ENGELLENİR ═══ */
{
  const { ctx, p } = await yeniSayfa();
  await p.fill("input[placeholder='Ad soyad']", "Test Kullanici");
  await p.fill("input[placeholder='05XX XXX XX XX']", "0532 123 45 67");
  await p.locator("[data-terms-check]").check();
  await p.waitForTimeout(400);
  /* Her şey dolu ama TİP YOK: buton hâlâ kilitli olmalı */
  check("tip yokken: form dolu olsa da buton KİLİTLİ", await p.locator("[data-wa-submit]").isDisabled());
  await p.screenshot({ path: `${out}/4-kilitli-buton.png`, fullPage: true });

  /* Zorla göndermeyi dene: form submit olayını tetikle */
  const oncekiUrl = p.url();
  await p.evaluate(() => document.querySelector("form")?.requestSubmit?.());
  await p.waitForTimeout(2000);
  check("tip yokken: sipariş KURULMADI", (await p.locator("[data-wa-done]").count()) === 0 && p.url() === oncekiUrl);
  await ctx.close();
}

/* ═══ 4) SUNUCU: tip olmadan 4xx ═══ */
{
  const govde = { items: [{ id: "smooky", qty: 1 }], name: "Test Kullanici", phone: "05321234567", requested_at: "simdi", locale: "tr", terms_accepted: true, channel: "whatsapp" };
  for (const [ad, ek] of [["tip yok", {}], ["tip boş", { type: "" }], ["tip geçersiz", { type: "kargo" }]]) {
    const r = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...govde, ...ek }) });
    const j = await r.json().catch(() => ({}));
    check(`sunucu: ${ad} → 4xx`, r.status >= 400 && r.status < 500 && j.errors?.some((e) => e.field === "type"), `HTTP ${r.status} ${JSON.stringify(j.errors ?? "")}`);
  }
}

/* ═══ 5) KURYE KAPALIYKEN: düğme devre dışı + etiket, gel-al yine TIKLANMALI ═══ */
{
  await servis({ delivery_open: false });
  const { ctx, p } = await yeniSayfa();
  check("kurye kapalı: düğme devre dışı", await p.locator("[data-mode-delivery]").isDisabled());
  check("kurye kapalı: 'şu an kapalı' etiketi", ((await p.locator("[data-mode-delivery]").textContent()) ?? "").includes("kapalı"), ((await p.locator("[data-mode-delivery]").textContent()) ?? "").replace(/\s+/g, " ").trim());
  /* OTOMATİK SEÇİM YOK: gel-al açık olsa da kendiliğinden seçilmemeli */
  check("kurye kapalı: gel-al OTOMATİK seçilmedi", (await p.locator('.seg button[aria-pressed="true"]').count()) === 0);
  check("kurye kapalı: buton hâlâ kilitli", await p.locator("[data-wa-submit]").isDisabled());
  await p.screenshot({ path: `${out}/5-kurye-kapali.png`, fullPage: true });

  /* Gel-al'e tıklayınca açılmalı */
  await p.getByRole("button", { name: "Gel-al" }).click();
  await p.waitForTimeout(500);
  check("kurye kapalı: gel-al tıklanınca seçildi", (await p.locator("[data-mode-pickup]").getAttribute("aria-pressed")) === "true");
  await ctx.close();
  await servis({ delivery_open: true });
}

await browser.close();
console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
console.log(`kareler: ${out}/`);
process.exit(fail ? 1 : 0);
