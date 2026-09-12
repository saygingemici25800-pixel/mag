/**
 * ÇALIŞMA SAATLERİ — saf mantık testi (tarayıcı gerekmez).
 *
 * İşletmeden onaylı saatler (12 Eyl 2026):
 *   Pazartesi–Cumartesi  12:00 – 00:00
 *   Pazar                16:00 – 23:00
 *
 * Kritik kabul: gece yarısını geçen aralık doğru işlenmeli —
 *   23:50 AÇIK  ·  00:10 KAPALI
 *
 * Saat dilimi Europe/Istanbul. Testte tarih ISO + "+03:00" ile verilir, böylece
 * makinenin yerel saat dilimi sonucu etkilemez.
 *
 * Çalıştırma: node --experimental-strip-types tests/e2e/saatler.mjs
 *   (ya da tsx: npx tsx tests/e2e/saatler.mjs)
 */
import { isOpen, istanbulNow, timeSlots, nextOpeningParts, todayRangeLabel, groupedHours, hoursFor, fmtMin, HOURS } from "../../lib/hours.ts";

let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};
const D = (iso) => new Date(iso);

/* Test tarihlerinin gerçekten hangi gün olduğu doğrulanır: yanlış tarih seçip
   "hata" sanmak kolay (bir kez oldu). 2026-09-12 Cumartesi, 13 Pazar, 14 Pazartesi. */
const WD = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const dayOf = (iso) => istanbulNow(D(iso)).day;
check("tarih kontrolü: 2026-09-12 Cumartesi", dayOf("2026-09-12T12:00:00+03:00") === 6, WD[dayOf("2026-09-12T12:00:00+03:00")]);
check("tarih kontrolü: 2026-09-13 Pazar", dayOf("2026-09-13T12:00:00+03:00") === 0, WD[dayOf("2026-09-13T12:00:00+03:00")]);
check("tarih kontrolü: 2026-09-14 Pazartesi", dayOf("2026-09-14T12:00:00+03:00") === 1, WD[dayOf("2026-09-14T12:00:00+03:00")]);

/* ---- 1) İSTENEN KABUL: 23:50 açık, 00:10 kapalı ---- */
check("Pazartesi 23:50 AÇIK", isOpen(D("2026-09-14T23:50:00+03:00")) === true);
check("Salı 00:10 KAPALI", isOpen(D("2026-09-15T00:10:00+03:00")) === false);

/* ---- 2) Gece yarısı sınırı tam nerede? 12:00–00:00 gece yarısında BİTER ---- */
check("Pazartesi 23:59 açık (kapanış öncesi son dakika)", isOpen(D("2026-09-14T23:59:00+03:00")) === true);
check("Salı 00:00 kapalı (kapanış anı)", isOpen(D("2026-09-15T00:00:00+03:00")) === false);
check("Salı 00:01 kapalı", isOpen(D("2026-09-15T00:01:00+03:00")) === false);
check("Salı 11:59 kapalı (açılış öncesi)", isOpen(D("2026-09-15T11:59:00+03:00")) === false);
check("Salı 12:00 açık (açılış anı)", isOpen(D("2026-09-15T12:00:00+03:00")) === true);

/* ---- 3) Pazar farklı: 16:00–23:00 ---- */
check("Pazar 15:59 kapalı", isOpen(D("2026-09-13T15:59:00+03:00")) === false);
check("Pazar 16:00 açık", isOpen(D("2026-09-13T16:00:00+03:00")) === true);
check("Pazar 22:59 açık", isOpen(D("2026-09-13T22:59:00+03:00")) === true);
check("Pazar 23:00 KAPALI (Pazar erken kapanır)", isOpen(D("2026-09-13T23:00:00+03:00")) === false);
check("Pazar 23:30 kapalı", isOpen(D("2026-09-13T23:30:00+03:00")) === false);
/* Cumartesi 00:00'da kapanır, yani Pazar 00:30 KAPALI (Cmt penceresi gece yarısını aşmaz) */
check("Pazar 00:30 kapalı (Cmt 00:00'da kapandı)", isOpen(D("2026-09-13T00:30:00+03:00")) === false);

/* ---- 4) Hafta içi gün ortası ---- */
for (const [iso, label] of [
  ["2026-09-14T13:00:00+03:00", "Pazartesi 13:00"],
  ["2026-09-16T18:30:00+03:00", "Çarşamba 18:30"],
  ["2026-09-12T20:00:00+03:00", "Cumartesi 20:00"],
])
  check(label + " açık", isOpen(D(iso)) === true);

/* ---- 5) Bir sonraki açılış mesajı ---- */
{
  // Salı 00:10 kapalı → aynı gün 12:00'de açılır ("bugün")
  const a = nextOpeningParts(D("2026-09-15T00:10:00+03:00"));
  check("Salı 00:10 → sonraki açılış 12:00, bugün", a.open === "12:00" && a.relDay === 0, JSON.stringify(a));
  // Pazar 23:30 kapalı → Pazartesi 12:00 ("yarın")
  const b = nextOpeningParts(D("2026-09-13T23:30:00+03:00"));
  check("Pazar 23:30 → sonraki açılış 12:00, yarın", b.open === "12:00" && b.relDay === 1, JSON.stringify(b));
  // Pazar 10:00 kapalı → aynı gün 16:00 ("bugün")
  const c = nextOpeningParts(D("2026-09-13T10:00:00+03:00"));
  check("Pazar 10:00 → sonraki açılış 16:00, bugün", c.open === "16:00" && c.relDay === 0, JSON.stringify(c));
  // Cumartesi 23:59 açık ama sorulursa sonraki açılış Pazar 16:00
  const e = nextOpeningParts(D("2026-09-12T23:59:00+03:00"));
  check("Cumartesi 23:59 → sonraki açılış Pazar 16:00", e.open === "16:00" && e.relDay === 1, JSON.stringify(e));
}

/* ---- 6) Bugünün aralığı etiketi ---- */
check("Pazartesi aralığı 12:00–00:00", todayRangeLabel(D("2026-09-14T13:00:00+03:00")) === "12:00–00:00", todayRangeLabel(D("2026-09-14T13:00:00+03:00")));
check("Pazar aralığı 16:00–23:00", todayRangeLabel(D("2026-09-13T18:00:00+03:00")) === "16:00–23:00", todayRangeLabel(D("2026-09-13T18:00:00+03:00")));

/* ---- 7) Gruplama: Pzt–Cmt tek satır, Pazar ayrı ---- */
{
  const g = groupedHours();
  check("iki grup (Pzt–Cmt · Paz)", g.length === 2, JSON.stringify(g));
  check("1. grup 6 gün, 12:00–00:00", g[0].days.length === 6 && g[0].label === "12:00–00:00", JSON.stringify(g[0]));
  check("2. grup Pazar, 16:00–23:00", g[1].days.length === 1 && g[1].days[0] === 0 && g[1].label === "16:00–23:00", JSON.stringify(g[1]));
}

/* ---- 8) Zaman dilimleri kapanışı aşmasın ---- */
{
  const s1 = timeSlots(D("2026-09-14T23:00:00+03:00"));
  check("Pazartesi 23:00 dilimleri kapanışı aşmıyor (son 23:30)", s1.length > 0 && s1.at(-1) === "23:30", s1.join(" "));
  const s2 = timeSlots(D("2026-09-13T21:00:00+03:00"));
  check("Pazar 21:00 dilimleri 22:30'da bitiyor (kapanış 23:00)", s2.at(-1) === "22:30", s2.join(" "));
  const s3 = timeSlots(D("2026-09-15T00:10:00+03:00"));
  check("kapalıyken dilim yok", Array.isArray(s3) && s3.length === 0, JSON.stringify(s3));
  const s4 = timeSlots(D("2026-09-13T22:45:00+03:00"));
  check("Pazar 22:45: yalnızca 'simdi' (kapanışa 15 dk)", s4.length === 1 && s4[0] === "simdi", s4.join(" "));
}

/* ---- 9) Veri bütünlüğü ---- */
check("yedi gün tanımlı", HOURS.length === 7, String(HOURS.length));
check("gün indeksleri 0..6 sırayla", HOURS.every((h, i) => h.day === i));
check("Pazar 16:00–23:00 (veri)", fmtMin(hoursFor(0).openMin) === "16:00" && fmtMin(hoursFor(0).closeMin) === "23:00");
check("Pazartesi 12:00–00:00 (veri)", fmtMin(hoursFor(1).openMin) === "12:00" && fmtMin(hoursFor(1).closeMin) === "00:00");
check("her gün açılış < kapanış", HOURS.every((h) => h.openMin < h.closeMin));

/* ---- 10) Sipariş doğrulaması saati kullanıyor mu? ---- */
{
  const { validateOrder } = await import("../../lib/orders.ts");
  const base = {
    type: "pickup",
    items: [{ id: "smooky", qty: 1 }],
    name: "Test Kullanıcı",
    phone: "0555 555 55 55",
    requested_at: "simdi",
  };
  const closedErrs = validateOrder(base, D("2026-09-15T00:10:00+03:00"));
  check("KAPALI saatte sipariş reddedilir (hours/closed)", closedErrs.some((e) => e.field === "hours" && e.code === "closed"), JSON.stringify(closedErrs));
  const openErrs = validateOrder(base, D("2026-09-14T13:00:00+03:00"));
  check("AÇIK saatte saat hatası yok", !openErrs.some((e) => e.field === "hours"), JSON.stringify(openErrs));
  const sundayLate = validateOrder(base, D("2026-09-13T23:30:00+03:00"));
  check("Pazar 23:30 sipariş reddedilir", sundayLate.some((e) => e.field === "hours" && e.code === "closed"), JSON.stringify(sundayLate));
}

/* ---- 11) Üç dilde saat metinleri ---- */
{
  const { getMessages } = await import("../../lib/i18n.ts");
  const { closedLabel, closedShortLabel, todayHoursLabel } = await import("../../lib/hoursLabel.ts");
  const closedAt = D("2026-09-13T23:30:00+03:00"); // Pazar gece, yarın 12:00
  const openAt = D("2026-09-14T13:00:00+03:00"); // Pazartesi
  for (const loc of ["tr", "en", "ru"]) {
    const t = getMessages(loc);
    const c = closedLabel(t, closedAt);
    const cs = closedShortLabel(t, closedAt);
    const th = todayHoursLabel(t, openAt);
    // yer tutucu kalmamalı, saat ve gün kelimesi geçmeli
    const noPlaceholder = !/\{(open|day|range)\}/.test(c + cs + th);
    check(`${loc}: kapalı metninde 12:00 ve gün var`, c.includes("12:00") && noPlaceholder, c);
    check(`${loc}: kısa kapalı metni dolu`, cs.includes("12:00") && cs.length > 6, cs);
    check(`${loc}: bugünün aralığı 12:00–00:00`, th.includes("12:00–00:00"), th);
    // gün kelimesi o dilin sözlüğünden gelmeli
    check(`${loc}: "yarın" karşılığı kullanılmış`, c.includes(t.order.tomorrow), t.order.tomorrow);
    // saat listesi metinleri
    check(`${loc}: açık/kapalı durum metinleri var`, !!t.contact.openNow && !!t.contact.closedNow && t.contact.weekdays.length === 7);
  }
}

/* ---- 12) SUNUCU KAPISI: panel anahtarı saatin ÜSTÜNE biner ----
   base verilirse (ör. node tests/e2e/saatler.mjs http://localhost:3141) canlı API
   denenir: saat İÇİNDE olsa bile panel "kapalı" diyorsa sipariş alınmaz (409).
   base verilmezse bu bölüm atlanır (saf mantık testi olarak da çalışsın). */
const base = process.argv[2];
if (base) {
  const PANEL_KEY = process.env.PANEL_KEY;
  const body = {
    type: "pickup",
    items: [{ id: "smooky", qty: 1 }],
    name: "Test Kullanıcı",
    phone: "0555 555 55 55",
    requested_at: "simdi",
  };
  const post = (p, b, headers = {}) =>
    fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(b) });
  if (!PANEL_KEY) {
    console.log("ATLANDI sunucu kapısı — PANEL_KEY yok (PANEL_KEY=… ile çalıştır)");
  } else {
    const login = await post("/api/panel/login", { key: PANEL_KEY });
    const raw = login.headers.getSetCookie?.() ?? [];
    const hdr = login.headers.get("set-cookie");
    const cookie = (raw.length ? raw : hdr ? [hdr] : []).map((c) => c.split(";")[0]).join("; ");
    /* Girişin 401 dönmesi bu testi DÜŞÜRMEZ: sunucuda PANEL_KEY tanımsızsa
       panelMode() "open" olur (lib/panel-auth.ts — geliştirmede bilinçli olarak açık,
       üretimde her zaman 401). O durumda PATCH'ler çerezsiz de geçer ve asıl ölçtüğümüz
       şey — "panel kapalıysa saat içinde sipariş alınmaz" — yine doğrulanır.
       Not: .env.local'de anahtar LIVE_PANEL_KEY adıyla duruyor, PANEL_KEY olarak değil. */
    if (!login.ok) console.log(`ATLANDI panel girişi — HTTP ${login.status} (sunucuda PANEL_KEY yok; panelMode=open)`);
    else check("panel girişi", cookie.length > 0, `çerez ${cookie ? "var" : "yok"}`);
    const patch = (open) =>
      fetch(base + "/api/panel/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ ordering_open: open }),
      });
    /* Saat içinde + panel KAPALI → 409 ordering-closed (saat hatası değil!) */
    await patch(false);
    const closed = await post("/api/orders", body);
    const cj = await closed.json().catch(() => ({}));
    check(
      "panel kapalı: saat içinde olsa bile sipariş alınmaz (409)",
      closed.status === 409 && JSON.stringify(cj).includes("ordering-closed"),
      `HTTP ${closed.status} ${JSON.stringify(cj).slice(0, 120)}`,
    );
    /* Panel açık → sipariş geçer (201) ya da ödeme sağlayıcısı yoksa 503;
       ikisi de "saat/panel kapısı geçildi" demektir. */
    await patch(true);
    const open = await post("/api/orders", body);
    check("panel açık + saat içinde: kapı geçildi", open.status === 201 || open.status === 503, `HTTP ${open.status}`);
    await patch(true); // testin yan etkisi kalmasın
  }
}

console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
