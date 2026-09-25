/* Kurye / gel-al bağımsız şalterleri: panel, müşteri arayüzü, sunucu reddi, üç dil. */
import { chromium } from "playwright";
import { seedCart, FAKE_NOW } from "./_cart-fixture.mjs";
import { guard } from "../../scripts/test-guard.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const KEY = process.env.PANEL_KEY ?? "test1234";
await guard(base);
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const b = await chromium.launch();

const login = await fetch(base + "/api/panel/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: KEY }) });
const CK = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const setSvc = (body) => fetch(base + "/api/panel/settings", { method: "PATCH", headers: { "content-type": "application/json", cookie: CK }, body: JSON.stringify(body) });
const siparis = (type, ad) => fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type, ...(type === "delivery" ? { zone: "merkez", address: "Servis Test Sk. No:1" } : {}),
    items: [{ id: "smooky", qty: 2 }], name: ad, phone: "05321234567", requested_at: "simdi", terms_accepted: true, locale: "tr" }) });

/** Müşteri formunu aç, iki düğmenin durumunu oku */
async function form(lang = "") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seedCart(ctx, { smooky: 2 });
  const p = await ctx.newPage();
  await p.clock.install({ time: FAKE_NOW });
  await p.goto(base + lang + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(2300);
  /* Bu paket SERVİS şalterlerini ölçüyor; mesafeli satış onayı ayrı bir koşul.
     Kutu işaretlenmezse submit her durumda pasif kalır ve "ikisi açık →
     gönderim serbest" kontrolü yanlış sebeple düşer. Onay burada verilir. */
  const onay = p.locator("[data-terms-check]");
  if (await onay.count()) await onay.check().catch(() => {});
  await p.waitForTimeout(200);
  const st = await p.evaluate(() => ({
    pickupDisabled: document.querySelector("[data-mode-pickup]")?.disabled ?? null,
    deliveryDisabled: document.querySelector("[data-mode-delivery]")?.disabled ?? null,
    pickupSelected: document.querySelector("[data-mode-pickup]")?.getAttribute("aria-pressed") === "true",
    deliverySelected: document.querySelector("[data-mode-delivery]")?.getAttribute("aria-pressed") === "true",
    note: document.querySelector("[data-pickup-closed],[data-delivery-closed]")?.textContent?.trim() ?? "",
    allClosed: document.querySelector("[data-allclosed]")?.textContent?.trim() ?? "",
    hoursClosed: Boolean(document.querySelector("[data-hours-closed]")),
    submitDisabled: document.querySelector('button[type="submit"]')?.disabled ?? null,
  }));
  return { p, ctx, st };
}

/* ---------- 1) İKİSİ DE AÇIK ---------- */
await setSvc({ ordering_open: true, delivery_open: true, pickup_open: true });
{
  const { ctx, st } = await form();
  check("ikisi açık: iki düğme de seçilebilir", st.pickupDisabled === false && st.deliveryDisabled === false);
  /* 25 Eyl 2026: teslimat tipi ZORUNLU SEÇİM oldu. Tip seçilmeden gönderim
     kilitli — eskiden "pickup" varsayılı olduğu için serbest görünüyordu.
     Burada beklenen: tip YOKKEN kilitli, tip SEÇİLİNCE açık. */
  check("ikisi açık: tip seçilmeden gönderim KİLİTLİ", st.submitDisabled === true, `submitDisabled=${st.submitDisabled}`);
  await ctx.close();
}
{
  const { p, ctx } = await form();
  await p.getByRole("button", { name: "Gel-al" }).click();
  await p.waitForTimeout(600);
  const acik = await p.evaluate(() => document.querySelector('button[type="submit"]')?.disabled === false);
  check("ikisi açık: tip seçilince gönderim SERBEST", acik);
  await ctx.close();
}

/* ---------- 2) KURYE KAPALI ---------- */
await setSvc({ delivery_open: false });
{
  const { p, ctx, st } = await form();
  check("kurye kapalı: kurye düğmesi pasif", st.deliveryDisabled === true);
  check("kurye kapalı: gel-al seçilebilir", st.pickupDisabled === false);
  /* OTOMATİK SEÇİM KALDIRILDI (kullanıcı kararı): tek tür açık olsa bile soru
     sorulur, kendiliğinden seçilmez. */
  check("kurye kapalı: gel-al OTOMATİK SEÇİLMEZ", !st.pickupSelected && !st.deliverySelected, `pickup=${st.pickupSelected} delivery=${st.deliverySelected}`);
  check("kurye kapalı: sebep yazıyor", /Kurye şu an kapalı/.test(st.note), st.note);
  await p.screenshot({ path: "docs/screens/servisler/kurye-kapali-390.png" });
  await ctx.close();
}
check("SUNUCU: kapalı kurye türü reddedildi", await siparis("delivery", "Kapali Kurye").then(async (r) => r.status === 409 && (await r.json()).errors?.[0]?.code === "delivery-closed"));
check("SUNUCU: açık gel-al kabul edildi", await siparis("pickup", "Acik GelAl A").then((r) => r.status === 201 || r.status === 503));

/* ---------- 3) GEL-AL KAPALI ---------- */
await setSvc({ delivery_open: true, pickup_open: false });
{
  const { p, ctx, st } = await form();
  check("gel-al kapalı: gel-al düğmesi pasif", st.pickupDisabled === true);
  check("gel-al kapalı: kurye OTOMATİK SEÇİLMEZ", !st.pickupSelected && !st.deliverySelected, `pickup=${st.pickupSelected} delivery=${st.deliverySelected}`);
  check("gel-al kapalı: sebep yazıyor", /Gel-al şu an kapalı/.test(st.note), st.note);
  await p.screenshot({ path: "docs/screens/servisler/gelal-kapali-390.png" });
  await ctx.close();
}
check("SUNUCU: kapalı gel-al türü reddedildi", await siparis("pickup", "Kapali GelAl").then(async (r) => r.status === 409 && (await r.json()).errors?.[0]?.code === "pickup-closed"));

/* ---------- 4) İKİSİ DE KAPALI ---------- */
await setSvc({ delivery_open: false, pickup_open: false });
{
  const { p, ctx, st } = await form();
  check("ikisi kapalı: iki düğme de pasif", st.pickupDisabled === true && st.deliveryDisabled === true);
  check("ikisi kapalı: gönderim engelli", st.submitDisabled === true);
  check("ikisi kapalı: net mesaj", /sipariş alamıyoruz/i.test(st.allClosed), st.allClosed);
  await p.screenshot({ path: "docs/screens/servisler/ikisi-kapali-390.png" });
  await ctx.close();
}
for (const t of ["pickup", "delivery"]) {
  check(`SUNUCU: ikisi kapalıyken ${t} reddedildi`, await siparis(t, "Hepsi Kapali").then((r) => r.status === 409));
}

/* ---------- 5) ANA ŞALTER tür şalterlerini EZER ---------- */
await setSvc({ ordering_open: false, delivery_open: true, pickup_open: true });
check("ana şalter kapalı: tür açık olsa da sipariş yok", await siparis("pickup", "Ana Kapali").then(async (r) => r.status === 409 && (await r.json()).errors?.[0]?.code === "ordering-closed"));

/* ---------- 6) SAAT kapalı + kurye kapalı: hangi mesaj? ---------- */
await setSvc({ ordering_open: true, delivery_open: false, pickup_open: true });
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seedCart(ctx, { smooky: 2 });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date("2026-09-03T03:00:00+03:00") }); // dükkân KAPALI saat
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  await p.waitForTimeout(2300);
  const saat = await p.evaluate(() => ({
    hours: Boolean(document.querySelector("[data-hours-closed]")),
    all: Boolean(document.querySelector("[data-allclosed]")),
    closed: Boolean(document.querySelector("[data-closed]")),
  }));
  check("saat kapalıyken SAAT mesajı görünür", saat.hours);
  check("saat kapalıyken servis mesajı ÇAKIŞMAZ", !saat.all && !saat.closed, JSON.stringify(saat));
  await p.screenshot({ path: "docs/screens/servisler/saat-kapali-390.png" });
  await ctx.close();
}

/* ---------- 7) TR/EN/RU ---------- */
await setSvc({ delivery_open: false, pickup_open: true });
for (const [lang, pre, re] of [["TR", "", /Kurye şu an kapalı/], ["EN", "/en", /Courier is currently closed/], ["RU", "/ru", /Доставка сейчас недоступна/]]) {
  const { ctx, st } = await form(pre);
  check(`${lang}: kapalı kurye sebebi çevrili`, re.test(st.note), st.note);
  await ctx.close();
}

/* ---------- temizlik ---------- */
await setSvc({ ordering_open: true, delivery_open: true, pickup_open: true });
const son = await (await fetch(base + "/api/panel/settings")).json();
check("temizlik: üçü de açık", son.ordering_open && son.delivery_open && son.pickup_open);

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
