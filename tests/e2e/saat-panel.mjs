/* Panelden saat/tatil yönetimi: gün kapatma, özel gün, gece yarısı, sonraki açılış, saat dilimi. */
import { chromium } from "playwright";
import { guard } from "../../scripts/test-guard.mjs";
const base = process.argv[2] ?? "http://localhost:3112";
const KEY = process.env.PANEL_KEY ?? "test1234";
await guard(base);
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const b = await chromium.launch();

const login = await fetch(base + "/api/panel/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: KEY }) });
const CK = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const setSch = (schedule) => fetch(base + "/api/panel/settings", { method: "PATCH", headers: { "content-type": "application/json", cookie: CK }, body: JSON.stringify({ schedule }) });
const H = (h, m = 0) => h * 60 + m;
let BUGUN_CACHE = null;

/** Sunucunun yaşadığı "bugün" (MAG_FAKE_NOW ile donmuş olabilir).
    Test süreci o env'i görmüyor; bu yüzden SUNUCUYA sorulur: ileri tarihli bir
    özel gün yazılır, sunucu geçmişi ayıkladığı için kalan en küçük tarih
    sunucunun bugünü veya sonrasıdır. Daha basiti: adayları deneyip hangisinin
    ayıklanmadığına bakmak yerine, /api/panel/settings'e aday tarih yazıp
    geri okuyoruz. */
async function sunucununBugunu() {
  if (BUGUN_CACHE) return BUGUN_CACHE;
  /* Son 40 gün + gelecek 2 gün arasında aday tara: ayıklanmayan İLK tarih bugündür. */
  const taban = new Date();
  for (let off = -40; off <= 2; off++) {
    const d = new Date(taban.getTime() + off * 86400000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
    await setSch({ ...VARSAYILAN, special: [{ date: key, closed: true, note: "probe" }] });
    const s = await (await fetch(base + "/api/panel/settings")).json();
    if (s.schedule.special.some((x) => x.date === key)) { BUGUN_CACHE = key; return key; } // ayıklanmadı → bugün
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(taban);
}

const VARSAYILAN = { week: [
  { day: 0, openMin: H(16), closeMin: H(23) }, { day: 1, openMin: H(12), closeMin: H(24) },
  { day: 2, openMin: H(12), closeMin: H(24) }, { day: 3, openMin: H(12), closeMin: H(24) },
  { day: 4, openMin: H(12), closeMin: H(24) }, { day: 5, openMin: H(12), closeMin: H(24) },
  { day: 6, openMin: H(12), closeMin: H(24) }], special: [] };

/* ---------- 1) SAF MANTIK: gece yarısı + saat dilimi (sunucu TZ'sinden bağımsız) ---------- */
{
  const { isOpen, istanbulDateKey, nextOpening, fmtMin } = await import("../../lib/hours.ts");
  const D = (s) => new Date(s);
  check("Cmt 23:50 AÇIK (gece yarısını geçen pencere)", isOpen(D("2026-09-19T23:50:00+03:00")) === true);
  check("Paz 00:10 KAPALI", isOpen(D("2026-09-20T00:10:00+03:00")) === false);
  /* Aynı anlar UTC yazımıyla: sonuç DEĞİŞMEMELİ */
  check("UTC 20:50 = TR 23:50 → AÇIK", isOpen(D("2026-09-19T20:50:00Z")) === true);
  check("UTC 21:10 = TR 00:10 → KAPALI", isOpen(D("2026-09-19T21:10:00Z")) === false);
  check("istanbulDateKey UTC 21:10 → ertesi gün", istanbulDateKey(D("2026-09-19T21:10:00Z")) === "2026-09-20");
  const sch = { ...VARSAYILAN, special: [{ date: "2026-09-19", closed: true, note: "Bayram" }] };
  check("özel gün kapalı → o gün KAPALI", isOpen(D("2026-09-19T20:00:00+03:00"), sch) === false);
  const n = nextOpening(D("2026-09-19T20:00:00+03:00"), sch);
  check("sonraki açılış: ertesi gün 16:00", n.daysAhead === 1 && fmtMin(n.min) === "16:00", `+${n.daysAhead}g ${fmtMin(n.min)}`);
}

/* ---------- 2) PANEL: gün kapat → müşteri tarafı ---------- */
{
  const kapali = { ...VARSAYILAN, week: VARSAYILAN.week.map((d) => (d.day === 1 ? { ...d, openMin: 0, closeMin: 0 } : d)) };
  const r = await setSch(kapali);
  check("panel: Pazartesi kapatıldı (PATCH 200)", r.ok, "HTTP " + r.status);
  const s = await (await fetch(base + "/api/panel/settings")).json();
  check("kayıt DB'ye yazıldı", s.schedule.week.find((d) => d.day === 1).closeMin === 0);
  /* Pazartesi 13:00'da sipariş reddedilmeli (MAG_FAKE_NOW pazartesi değil, doğrudan mantıkla bak) */
  const { isOpen } = await import("../../lib/hours.ts");
  check("Pzt 13:00 kapalı (panel ayarı)", isOpen(new Date("2026-09-21T13:00:00+03:00"), s.schedule) === false);
  check("Sal 13:00 açık", isOpen(new Date("2026-09-22T13:00:00+03:00"), s.schedule) === true);
}

/* ---------- 3) BUGÜNE özel gün (kapalı) → sipariş alınamaz ---------- */
{
  /* Özel gün SUNUCUNUN bugününe eklenmeli (test süreci MAG_FAKE_NOW görmüyor). */
  const bugun = await sunucununBugunu();
  await setSch({ ...VARSAYILAN, special: [{ date: bugun, closed: true, note: "Test tatili" }] });
  const r = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "pickup", items: [{ id: "smooky", qty: 1 }], name: "Tatil Test", phone: "05321234567", requested_at: "simdi", locale: "tr" }) });
  const j = await r.json().catch(() => ({}));
  check("bugün tatil → sipariş reddedildi", r.status === 422 && j.errors?.some((e) => e.field === "hours"), `HTTP ${r.status} ${JSON.stringify(j.errors?.[0] ?? {})}`);
}

/* ---------- 4) GEÇERSİZ giriş sunucuda da reddedilir ---------- */
{
  const bozuk = { week: VARSAYILAN.week.map((d) => (d.day === 2 ? { ...d, openMin: 900, closeMin: 600 } : d)), special: [] };
  await setSch(bozuk);
  const s = await (await fetch(base + "/api/panel/settings")).json();
  const sal = s.schedule.week.find((d) => d.day === 2);
  check("kapanış<açılış kaydı varsayılana düştü", sal.openMin === 720 && sal.closeMin === 1440, `${sal.openMin}-${sal.closeMin}`);
  await setSch({ ...VARSAYILAN, special: [{ date: "1999-01-01", closed: true }] });
  const s2 = await (await fetch(base + "/api/panel/settings")).json();
  check("geçmiş tarihli özel gün ayıklandı", s2.schedule.special.length === 0, JSON.stringify(s2.schedule.special));
}

/* ---------- 5) İLETİŞİM sayfası: tablo + sonraki açılış (TR/EN/RU) ---------- */
{
  /* Tarayıcı MAG_FAKE_NOW görmez; GERÇEK bugüne tatil koyarız ki istemcinin
     hesabı da kapalı çıksın (sunucu kapısı zaten ayrı testte doğrulandı). */
  const gercekBugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  await setSch({ ...VARSAYILAN, special: [{ date: gercekBugun, closed: true, note: "Test tatili" }] });
  for (const [lang, pre, re] of [["TR", "", /açılıyoruz/i], ["EN", "/en", /We open/i], ["RU", "/ru", /Открываемся/i]]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(base + pre + "/", { waitUntil: "load" });
    await p.waitForTimeout(9000);
    await p.locator("[data-contact-open]").first().click().catch(() => {});
    await p.waitForTimeout(1500);
    const txt = (await p.locator("[data-hours-list]").first().textContent().catch(() => "")) ?? "";
    check(`${lang}: sonraki açılış mesajı`, re.test(txt), txt.replace(/\s+/g, " ").slice(-58));
    if (lang === "TR") await p.screenshot({ path: "docs/screens/saatler-panel/iletisim-390.png" });
    await ctx.close();
  }
}

/* ---------- temizlik ---------- */
await setSch(VARSAYILAN);
const son = await (await fetch(base + "/api/panel/settings")).json();
check("temizlik: varsayılan programa dönüldü", son.schedule.special.length === 0 && son.schedule.week.find((d) => d.day === 1).closeMin === 1440);

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
