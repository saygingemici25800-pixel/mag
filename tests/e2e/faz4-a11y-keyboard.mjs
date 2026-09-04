// Klavye ile tam sipariş akışı: yalnızca Tab / Shift+Tab / Enter / Space / ok tuşları / yazma.
// Faz 5 kurgusu: liste (/siparis) → sepet çubuğu → ödeme (/siparis/odeme) → mock ödeme.
// Teslimatta nakit/kart kaldırıldığı için ödeme radyo grubu yok; ödeme yalnızca online.
import { chromium } from "playwright";
import { FAKE_NOW, assertServerReady, clearCart, waitForCartCount } from "./_cart-fixture.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
await assertServerReady(base);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.clock.install({ time: FAKE_NOW }); // dükkân açık (sunucu: MAG_FAKE_NOW)
await clearCart(page);
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
let fail = 0; const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const focused = () => page.evaluate(() => {
  const e = document.activeElement;
  return (e?.tagName || "") +
    (e?.textContent?.trim().slice(0, 30) ? ":" + e.textContent.trim().slice(0, 30) : "") +
    (e?.getAttribute("aria-label") ? "[" + e.getAttribute("aria-label") + "]" : "") +
    (e?.getAttribute("placeholder") ? "{" + e.getAttribute("placeholder") + "}" : "");
});
/** Tab'la hedef bulan yardımcı */
async function tabTo(pred, max = 120) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await focused();
    if (pred(f)) return f;
  }
  return null;
}

// ---- 1) Ürün listesi: karttaki "Ekle" düğmesine Tab + Enter
await page.goto(base + "/siparis", { waitUntil: "load" });
await page.waitForTimeout(600);
check("Ekle butonuna klavyeyle ulaşıldı", (await tabTo((f) => f.startsWith("BUTTON") && f.includes("Ekle"))) !== null);
await page.keyboard.press("Enter");
await waitForCartCount(page, 1);
check("klavyeyle sepete eklendi (rozet 1)", (await page.$eval(".cb-badge", (e) => e.textContent)) === "1");

// aynı düğme artık "Ekle · 1" — tekrar Enter ile adet 2
await page.keyboard.press("Enter");
await waitForCartCount(page, 2);
check("ikinci Enter ile adet 2", (await page.$eval(".cb-badge", (e) => e.textContent)) === "2");

// ---- 2) Sepet çubuğuna Tab + Enter → ödeme sayfası
check("sepet çubuğuna ulaşıldı", (await tabTo((f) => f.includes("SEPETE GİT") || f.includes("Sepete git"))) !== null);
await page.keyboard.press("Enter");
await page.waitForURL(/\/siparis\/odeme/, { timeout: 8000 });
await page.waitForTimeout(600);

// ---- 3) Kurye segmentine Tab + Enter (Mahalle seçici ancak bundan sonra DOM'a girer)
check("Kurye butonuna klavyeyle ulaşıldı", (await tabTo((f) => f.startsWith("BUTTON:Kurye"))) !== null);
await page.keyboard.press("Enter");
await page.waitForSelector("select[aria-label=Mahalle]", { timeout: 5000 });

// ---- 4) Mahalle select: Tab + harf yazarak seçim
check("Mahalle seçicisine ulaşıldı", (await tabTo((f) => f.startsWith("SELECT"))) !== null);
await page.keyboard.type("Fet"); // Chromium'da ok tuşu açılır liste bekler
check("Mahalle klavyeyle seçildi", (await page.$eval("select[aria-label=Mahalle]", (e) => e.value)) !== "");

// ---- 5) ⓘ butonu: Enter → modal, Escape kapatır
const ib = await tabTo((f) => f.includes("[Minimum sepet"));
check("ⓘ butonuna ulaşıldı", ib !== null);
if (ib) {
  await page.keyboard.press("Enter"); await page.waitForTimeout(250);
  check("modal açıldı", (await page.$("[role=dialog]")) !== null);
  await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  check("Escape modalı kapattı", (await page.$("[role=dialog]")) === null);
}

// ---- 6) Form alanları: Tab sırası Adres → Ad soyad → Telefon
const addrReached = await tabTo((f) => f.startsWith("TEXTAREA"), 6);
check("Adres alanına ulaşıldı", addrReached !== null);
await page.keyboard.type("Karagözler Mah. Klavye Sk. No:1");
const nameReached = await tabTo((f) => f.includes("{Ad soyad}"), 6);
check("Ad soyad alanına Tab ile ulaşıldı", nameReached !== null);
await page.keyboard.type("Klavye Test");
const phoneReached = await tabTo((f) => f.includes("{05XX XXX XX XX}"), 6);
check("Telefon alanına ulaşıldı", phoneReached !== null);
await page.keyboard.type("05321112233");

// ---- 7) "Ödemeye geç": Tab + Enter → mock ödeme → onayla
const sub = await tabTo((f) => f.includes("ÖDEMEYE GEÇ") || f.includes("Ödemeye geç"), 12);
check("Ödemeye geç butonuna ulaşıldı", sub !== null);
await page.keyboard.press("Enter");
await page.waitForURL(/\/odeme\/test\?ref=/, { timeout: 15000 });
check("mock ödeme sayfasına klavyeyle geçildi", true);
/* Mock sağlayıcı sayfası ürünün parçası değil (yalnızca geliştirme/test sahnesi);
   klavye iddiası sipariş akışıyla ilgili, bu yüzden ödemeyi formdan onaylıyoruz. */
await page.locator("form:has(input[value=ok]) button").focus();
await page.keyboard.press("Enter");
await page.waitForURL(/\/siparis\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(() => {});
check("sipariş klavyeyle tamamlandı", /\/siparis\/[0-9a-f-]{36}$/.test(page.url()), page.url());
check("ödeme tamamlandı", (await page.getAttribute("[data-payment]", "data-payment")) === "paid");

// ---- 8) Takip sayfasında odak sırası
await page.keyboard.press("Tab");
const f1 = await focused();
check("takip sayfasında ilk odak", f1.length > 0, f1);

console.log("errors:", errs.length ? errs : "none");
await browser.close();
process.exit(fail ? 1 : 0);
