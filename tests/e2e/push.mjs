// Web Push — abonelik akışı ve bildirim yükü.
//  1) Yük biçimi: başlık "Yeni sipariş", gövdede sipariş NO + TUTAR, url derin bağlantı.
//  2) API sözleşmesi: yetkisiz 401, eksik anahtar 422, geçerli abonelik 201, DELETE siler.
//  3) Panel arayüzü: buton "Bildirimleri aç" → abone → "açık" + kapatma → kapat.
//     VAPID anahtarı yoksa buton HİÇ render edilmez (özellik sessizce kapalı).
//  4) Derin bağlantı: /panel#<id> ile açılınca o kart vurgulanır; panel zaten açıksa
//     service worker'ın postMessage'ı aynı işi yapar.
//
// GERÇEK TESLİMAT (FCM/APNs) BURADA DOĞRULANMAZ — o gerçek cihaz işi.
// Burada abonelik sözleşmesi, yük biçimi ve derin bağlantı denetlenir.
import { chromium } from "playwright";
import { assertServerReady, seedCart, fillDelivery, FAKE_NOW } from "./_cart-fixture.mjs";
import { newOrderPayload } from "../../lib/push-payload.ts";
import { shortId } from "../../lib/orders.ts";

const base = process.argv[2] ?? "http://localhost:3112";
const KEY = process.env.PANEL_KEY ?? "test1234";
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

/* ---------- 1) Bildirim yükü ---------- */
{
  const order = {
    id: "3f2a1b7c-9d4e-4f10-8a2b-5c6d7e8f9012",
    total: 1380,
    type: "pickup",
    items: [{ id: "smooky", name: "Smooky", qty: 2 }, { id: "ayran", name: "Arslan ayran", qty: 1 }],
  };
  const p = newOrderPayload(order);
  check("başlık tam olarak 'Yeni sipariş'", p.title === "Yeni sipariş", p.title);
  check("gövdede sipariş NO var", p.body.includes(shortId(order.id)), p.body);
  check("gövdede TUTAR var", p.body.includes("1380"), p.body);
  check("url o siparişe gider", p.url === `/panel#${order.id}`, p.url);
  check("tag = sipariş id (aynı sipariş tek bildirim)", p.tag === order.id);
  const kurye = newOrderPayload({ ...order, type: "delivery" });
  check("gel-al / kurye ayrımı gövdede", p.body.includes("Gel-al") && kurye.body.includes("Kurye"));
}

/* ---------- 2) sw.js: derin bağlantı hash'i ile başa çıkıyor mu ---------- */
{
  const { readFileSync } = await import("node:fs");
  const sw = readFileSync("public/sw.js", "utf8");
  check("sw.js push olayını dinliyor", /addEventListener\("push"/.test(sw));
  check("sw.js tıklamayı dinliyor", /addEventListener\("notificationclick"/.test(sw));
  /* Regresyon kilidi: url artık hash taşıyor. Eskiden `pathname === url`
     karşılaştırılıyordu; hash'li url hiçbir zaman eşleşmiyor, açık panel sekmesi
     bulunamıyor ve her tıklamada yeni pencere açılıyordu. */
  /* Yorum satırları eski kodu ANLATIYOR; yalnız gerçek koda bak. */
  const code = sw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("tıklama hash'i ayrıştırıyor (pathname === url karşılaştırması yok)", !/pathname\s*===\s*url\b/.test(code));
  check("url tam olarak ayrıştırılıyor (new URL)", /new URL\(\s*raw/.test(code));
  check("açık sekmeye sipariş id'si bildiriliyor", /mag-open-order/.test(sw));
}

await assertServerReady(base);

const b = await chromium.launch();

/* ---------- 3) API sözleşmesi ---------- */
{
  const ctx = await b.newContext();
  const sub = { endpoint: `https://example.com/mag-test-${Date.now()}`, keys: { p256dh: "BTestKey", auth: "ATestKey" } };
  const post = (data, opts = {}) => ctx.request.post(base + "/api/push/subscribe", { data, failOnStatusCode: false, ...opts });

  const anon = await post(sub);
  check("şifresiz POST /api/push/subscribe → 401", anon.status() === 401, String(anon.status()));
  const anonDel = await ctx.request.delete(base + "/api/push/subscribe", { data: { endpoint: sub.endpoint }, failOnStatusCode: false });
  check("şifresiz DELETE → 401", anonDel.status() === 401, String(anonDel.status()));

  /* giriş yap (çerez bu ctx'te kalır) */
  const login = await ctx.request.post(base + "/api/panel/login", { data: { key: KEY }, failOnStatusCode: false });
  check("panel girişi", login.ok(), String(login.status()));

  const bad = await post({ endpoint: sub.endpoint });
  check("anahtarsız abonelik reddedilir (422)", bad.status() === 422, String(bad.status()));
  const bad2 = await post({ keys: sub.keys });
  check("endpoint'siz abonelik reddedilir (422)", bad2.status() === 422, String(bad2.status()));

  const ok = await post(sub);
  check("geçerli abonelik kaydedilir (201)", ok.status() === 201, String(ok.status()));
  /* aynı endpoint iki kez: çift kayıt olmamalı (tek cihaz = tek bildirim) */
  const again = await post(sub);
  check("aynı endpoint tekrar gönderilebilir (201)", again.status() === 201, String(again.status()));

  const del = await ctx.request.delete(base + "/api/push/subscribe", { data: { endpoint: sub.endpoint }, failOnStatusCode: false });
  check("abonelik silinebilir", del.ok(), String(del.status()));
  await ctx.close();
}

/* ---------- 4) Panel arayüzü: buton durumları ---------- */
{
  /* İzin ORIGIN'e verilir; yalnız newContext({permissions}) yeterli değil —
     Notification.permission "denied" kalıyor ve buton pasif çiziliyor. */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(["notifications"], { origin: base });
  const p = await ctx.newPage();
  await p.goto(base + "/panel", { waitUntil: "load" });
  await p.fill("form input[type=password]", KEY);
  await p.click("form button[type=submit]");
  await p.waitForSelector(".tabs", { timeout: 8000 });

  const btn = await p.$("[data-push]");
  const vapidSet = await p.evaluate(() => Boolean(document.querySelector("[data-push]")));

  if (!btn) {
    /* Bu makinede NEXT_PUBLIC_VAPID_PUBLIC_KEY tanımsız: beklenen davranış,
       buton hiç çizilmez ve hiçbir hata görünmez. */
    check("VAPID yokken buton görünmez (özellik sessizce kapalı)", true);
    const errs = await p.$$eval("*", (els) => els.filter((e) => /push|bildirim/i.test(e.className ?? "") && /hata|error/i.test(e.textContent ?? "")).length);
    check("VAPID yokken hata mesajı da yok", errs === 0);
  } else {
    check("VAPID varken buton görünür", vapidSet);
    const label0 = (await p.textContent("[data-push]")) ?? "";
    check("buton 'Bildirimleri aç' der", /aç|Turn on|Включ/i.test(label0), label0.trim());
    /* izin durumu asenkron düzeltiliyor (Permissions API); biraz bekle */
    await p.waitForFunction(() => document.querySelector("[data-push]")?.dataset.push === "idle", null, { timeout: 5000 }).catch(() => {});
    check("başlangıç durumu idle", (await p.getAttribute("[data-push]", "data-push")) === "idle", await p.getAttribute("[data-push]", "data-push"));

    /* abone ol — headless Chromium'da gerçek push servisi yok, subscribe()
       başarısız olabilir; o yüzden iki kabul edilebilir sonuç var. */
    await p.click("[data-push]");
    await p.waitForFunction(() => document.querySelector("[data-push]")?.dataset.push !== "busy", null, { timeout: 15000 }).catch(() => {});
    const st = await p.getAttribute("[data-push]", "data-push");
    check("abonelik denemesi bir sonuca bağlandı (takılı kalmadı)", st !== "busy", `data-push=${st}`);

    if (st === "ok") {
      const label1 = (await p.textContent("[data-push]")) ?? "";
      check("'Bildirimler açık' gösterilir", /açık|on\b|включ/i.test(label1), label1.trim());
      check("kapatma seçeneği sunulur", /kapat|Turn off|Выключить/i.test(label1), label1.trim());
      /* sunucuya gerçekten yazıldı mı */
      const saved = await p.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const s = await reg?.pushManager.getSubscription();
        return s?.endpoint ?? "";
      });
      check("tarayıcıda abonelik var", saved.length > 0);
      /* kapat → başa dön */
      await p.click("[data-push]");
      await p.waitForFunction(() => document.querySelector("[data-push]")?.dataset.push === "idle", null, { timeout: 10000 }).catch(() => {});
      check("kapatınca abonelik bırakılır", (await p.getAttribute("[data-push]", "data-push")) === "idle");
      const after = await p.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return (await reg?.pushManager.getSubscription()) ? "var" : "yok";
      });
      check("tarayıcı aboneliği de silindi", after === "yok", after);
    } else {
      console.log(`     (headless ortamda push servisi yok → durum "${st}"; abonelik kaydı API testinde doğrulandı)`);
    }
  }
  await ctx.close();
}

/* ---------- 5) Derin bağlantı: /panel#<id> doğru karta gider ---------- */
{
  /* Test KENDİ siparişini oluşturur — panelde hazır kayıt OLDUĞUNU VARSAYMAZ.
     (Önce ".ocard" aranıyordu; temiz depoda hiç kart olmadığı için düşüyordu.)
     POST /api/orders tek başına yetmez: sipariş ödeme tamamlanana kadar panele
     düşmez, o yüzden mock ödeme akışı sonuna kadar yürütülür. */
  const shopCtx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seedCart(shopCtx, { smooky: 1, brisket: 1, ayran: 1 });
  const shop = await shopCtx.newPage();
  await shop.clock.install({ time: FAKE_NOW });
  await shop.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await shop.waitForTimeout(800);
  await fillDelivery(shop, { zone: "merkez", address: "Push Derin Baglanti Sk. No:1", name: "Push Derin Baglanti", phone: "05321234567" });
  await shop.click('button[type="submit"]');
  await shop.waitForURL(/\/odeme\/test/, { timeout: 15000 });
  await shop.getByRole("button", { name: "Ödemeyi tamamla" }).click();
  await shop.waitForURL(/\/siparis\/[0-9a-f-]{36}/, { timeout: 20000 });
  const newId = shop.url().split("/siparis/")[1]?.split("?")[0] ?? "";
  await shopCtx.close();

  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + "/panel", { waitUntil: "load" });
  await p.fill("form input[type=password]", KEY);
  await p.click("form button[type=submit]");
  await p.waitForSelector(".tabs", { timeout: 8000 });

  const id = newId;
  check("test kendi siparişini oluşturdu", /^[0-9a-f-]{36}$/.test(id), id);
  await p.waitForSelector(`.ocard[data-id="${id}"]`, { timeout: 15000 });

  if (id) {
    const payload = newOrderPayload({ id, total: 1, type: "pickup", items: [] });
    /* Bildirimden gelme senaryosu: panel KAPALIYDI, sw.js YENİ SEKME açar.
       Aynı sekmede yalnız hash'i değiştirmek sayfayı yeniden kurmaz (SPA) —
       gerçek davranışı ölçmek için temiz sekme kullanılır. Çerez context'te,
       yeniden giriş gerekmiyor. */
    const np = await ctx.newPage();
    await np.goto(base + payload.url, { waitUntil: "load" });
    await np.waitForSelector(".tabs", { timeout: 10000 });
    await np.waitForSelector(`.ocard[data-id="${id}"]`, { timeout: 15000 });
    const hit = await np.waitForFunction(
      (oid) => document.querySelector(`.ocard[data-id="${oid}"]`)?.classList.contains("deeplink"),
      id,
      { timeout: 6000 },
    ).then(() => true).catch(() => false);
    check("bildirim url'i o siparişi vurguluyor", hit);
    /* kart görünür alanda mı */
    const inView = await np.evaluate((oid) => {
      const el = document.querySelector(`.ocard[data-id="${oid}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    }, id);
    check("kart ekrana kaydırıldı", inView);
    /* hash temizlendi mi (yenilemede tekrar kaydırmasın) */
    await np.waitForTimeout(2600);
    check("hash temizlendi", (await np.evaluate(() => location.hash)) === "");

    /* panel ZATEN AÇIKKEN: sw.js'in postMessage yolu */
    await np.evaluate((oid) => {
      navigator.serviceWorker.dispatchEvent(Object.assign(new MessageEvent("message", { data: { type: "mag-open-order", id: oid } }), {}));
    }, id).catch(() => {});
    const hit2 = await np.waitForFunction(
      (oid) => document.querySelector(`.ocard[data-id="${oid}"]`)?.classList.contains("deeplink"),
      id,
      { timeout: 4000 },
    ).then(() => true).catch(() => false);
    check("panel açıkken de mesajla o siparişe gidilir", hit2);
  }
  await ctx.close();
}

await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
