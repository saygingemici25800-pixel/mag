/**
 * Sepet fixture'ı ve sipariş akışı yardımcıları — üç e2e testi de bunu kullanır.
 *
 * Neden tek yerde: sepetin localStorage şeması (`mag:cart`, {v:1, lines:{id:{qty,note}}})
 * ve Faz 5 akışının adımları (liste → sheet → çubuk → /siparis/odeme) değişirse
 * testlerin tek noktadan güncellenmesi gerekir.
 */

/** localStorage anahtarı ve sürümü — lib/cart.ts ile birebir aynı olmalı */
export const CART_KEY = "mag:cart";
export const CART_VERSION = 1;

/** Testlerde kullanılan sabit saat: dükkân açık (sunucu tarafı MAG_FAKE_NOW ile eşlenir) */
export const FAKE_NOW = new Date("2026-09-03T12:00:00+03:00");

/**
 * Sepeti sayfa yüklenmeden ÖNCE doldur (addInitScript): ilk render doğru sepetle gelir,
 * hydration sırasında boş sepet görünüp sonra dolmaz.
 * @param {import("playwright").Page|import("playwright").BrowserContext} target
 * @param {Record<string, number|{qty:number,note?:string}>} lines  ör. { smooky: 2, "mag-sos": 1 }
 */
export async function seedCart(target, lines) {
  const normalized = Object.fromEntries(
    Object.entries(lines).map(([id, v]) => [id, typeof v === "number" ? { qty: v, note: "" } : { qty: v.qty, note: v.note ?? "" }]),
  );
  await target.addInitScript(
    ([key, version, value]) => {
      localStorage.setItem(key, JSON.stringify({ v: version, lines: value }));
      localStorage.setItem("mag:sound", "0");
    },
    [CART_KEY, CART_VERSION, normalized],
  );
}

/** Sepeti boşalt (yine sayfa yüklenmeden önce) */
export async function clearCart(target) {
  await target.addInitScript(([key]) => {
    localStorage.removeItem(key);
    localStorage.setItem("mag:sound", "0");
  }, [CART_KEY]);
}

/** Sepetin o anki içeriği (sayfa açıkken) */
export async function readCart(page) {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).lines : {};
    } catch {
      return {};
    }
  }, CART_KEY);
}

/** Sepetteki toplam adet */
export async function cartCount(page) {
  const lines = await readCart(page);
  return Object.values(lines).reduce((s, l) => s + (l?.qty ?? 0), 0);
}

/**
 * Sepete ekleme animasyonu veriyi start+0.6 s'de yazar ve uçuş ~1.9 s sürer; sıraya giren
 * ikinci ekleme bunu ikiye katlar. Bu yüzden testler "rozet şu olsun" derken beklemeli.
 * @param {import("playwright").Page} page
 * @param {number} expected beklenen toplam adet
 */
export async function waitForCartCount(page, expected, timeout = 8000) {
  await page.waitForFunction(
    ([key, want]) => {
      try {
        const raw = localStorage.getItem(key);
        const lines = raw ? JSON.parse(raw).lines : {};
        return Object.values(lines).reduce((s, l) => s + (l?.qty ?? 0), 0) === want;
      } catch {
        return false;
      }
    },
    [CART_KEY, expected],
    { timeout },
  );
  /* rozet DOM'a bir kare sonra yansır */
  await page.waitForFunction(
    (want) => document.querySelector("[data-cart-badge]")?.textContent === String(want),
    expected,
    { timeout: 3000 },
  );
}

/**
 * Faz 5 akışı: /siparis/odeme'de kurye seçip adres alanlarını doldurur.
 * "Mahalle" seçici ancak Kurye seçilince DOM'a girer — sıra önemlidir.
 */
export async function fillDelivery(page, { zone = "merkez", address, name, phone }) {
  await page.getByRole("button", { name: "Kurye" }).click();
  await page.waitForSelector("select[aria-label=Mahalle]", { timeout: 5000 });
  await page.selectOption("select[aria-label=Mahalle]", zone);
  if (address) await page.fill("textarea", address);
  if (name) await page.fill("input[placeholder='Ad soyad']", name);
  if (phone) await page.fill("input[placeholder='05XX XXX XX XX']", phone);
}

/** Panel anahtarı: sunucu PANEL_KEY ile başlatılmalı (yoksa üretim modunda her istek 401). */
export const PANEL_KEY = process.env.PANEL_KEY ?? "test1234";

/**
 * Bu testler `next start` (üretim modu) altında çalışır ve üretimde bazı ayarlar zorunludur:
 *   PANEL_KEY=test1234                          → panel girişi (yoksa her istek 401)
 *   PAYMENT_PROVIDER=mock                       → /odeme/test (yoksa 503 provider-unavailable)
 *   MAG_FAKE_NOW=2026-09-03T12:00:00+03:00      → dükkân açık (tarayıcı saatiyle eşlenir)
 *   NEXT_PUBLIC_SITE_URL=http://localhost:3112  → ödeme dönüş adresi; varsayılan 3000'e gider
 *
 * Örnek (port 3112):
 *   PANEL_KEY=test1234 PAYMENT_PROVIDER=mock MAG_FAKE_NOW=2026-09-03T12:00:00+03:00 \
 *   NEXT_PUBLIC_SITE_URL=http://localhost:3112 pnpm start -p 3112
 */
export const REQUIRED_SERVER_ENV = ["PANEL_KEY", "PAYMENT_PROVIDER", "MAG_FAKE_NOW", "NEXT_PUBLIC_SITE_URL"];

/** Sunucu test ayarlarıyla mı başlatılmış? Değilse testi anlamlı bir mesajla düşür. */
export async function assertServerReady(base) {
  const r = await fetch(base + "/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Hazirlik Kontrol", phone: "05321234567", requested_at: "simdi", locale: "tr" }),
  });
  const hint =
    `Şununla başlat: PANEL_KEY=test1234 PAYMENT_PROVIDER=mock ` +
    `MAG_FAKE_NOW=2026-09-03T12:00:00+03:00 NEXT_PUBLIC_SITE_URL=${base} pnpm start -p ${new URL(base).port || 80}`;
  if (r.status === 503) {
    const body = await r.json().catch(() => ({}));
    throw new Error(`Sunucu test ayarlarıyla başlatılmamış (${JSON.stringify(body)}).\n${hint}`);
  }
  /* Ödeme dönüş adresi yanlış porta giderse tarayıcı ERR_CONNECTION_REFUSED alır. */
  if (r.status === 201) {
    const body = await r.json().catch(() => ({}));
    const url = body?.redirectUrl ?? "";
    if (url && !url.startsWith(base)) {
      throw new Error(`Ödeme dönüş adresi ${url} — sunucu ${base} beklerken başka adrese yönlendiriyor.\n${hint}`);
    }
  }
}
