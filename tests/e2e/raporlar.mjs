/* Panel raporları: elle hesaplanmış rakamlar, iptal ayrımı, gün sınırı, CSV, arayüz. */
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { guard } from "../../scripts/test-guard.mjs";
import { SIPARISLER, BEKLENEN, BEKLENEN_16, BEKLENEN_17 } from "./_rapor-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const KEY = process.env.PANEL_KEY ?? "test1234";
let pass = 0, fail = 0;
const check = (ad, ok, detay = "") => {
  if (ok) { pass++; console.log("  ✓ " + ad); }
  else { fail++; console.log("  ✗ " + ad + (detay ? "  → " + detay : "")); }
};
const esit = (ad, bekl, gercek) => check(`${ad}: ${bekl}`, bekl === gercek, `gerçek ${gercek}`);

await guard(base);

/* Stub depoya sabit veri yaz — canlıya DOKUNULMAZ (.env.test Supabase'siz). */
const DIR = path.join(process.cwd(), ".data");
await mkdir(DIR, { recursive: true });
await writeFile(path.join(DIR, "orders.json"), JSON.stringify(SIPARISLER, null, 2));

const api = (qs) => fetch(`${base}/api/panel/reports?${qs}`, { headers: { "x-panel-key": KEY } });

/* ---------- 1) YETKİ ---------- */
{
  const r = await fetch(`${base}/api/panel/reports?from=2026-09-15&to=2026-09-17`);
  esit("anahtarsız istek reddedilir", 401, r.status);
}

/* ---------- 2) ELLE HESAP: özet ---------- */
const r = await (await api(`from=${BEKLENEN.from}&to=${BEKLENEN.to}`)).json();
{
  const s = r.summary;
  esit("sipariş sayısı", BEKLENEN.summary.orders, s.orders);
  esit("toplam ciro", BEKLENEN.summary.revenue, s.revenue);
  esit("kurye", BEKLENEN.summary.delivery, s.delivery);
  esit("gel-al", BEKLENEN.summary.pickup, s.pickup);
  esit("iptal", BEKLENEN.summary.cancelled, s.cancelled);
  esit("aralıktaki tüm kayıt", BEKLENEN.summary.total_all, s.total_all);
  esit("ortalama sepet", BEKLENEN.ortalama, Math.round(s.revenue / s.orders));
}

/* ---------- 3) İPTAL CİROYA GİRMİYOR ---------- */
{
  /* C siparişi 3× smooky = 1140. Ciroya girseydi 3100 değil 4240 olurdu. */
  check("iptal edilen sipariş ciroya EKLENMEMİŞ", r.summary.revenue === 3100, `ciro ${r.summary.revenue} (iptal dahil olsaydı 4240)`);
  /* Ödenmemiş G siparişi de sayılmamalı: 5× smooky = 1900 */
  check("ödenmemiş sipariş ciroya EKLENMEMİŞ", r.summary.revenue === 3100, `ciro ${r.summary.revenue} (G dahil olsaydı 5000)`);
  const smooky = r.items.find((x) => x.id === "smooky");
  esit("iptal edilen ürün adedi ürün listesine girmemiş (smooky)", 3, smooky?.qty);
}

/* ---------- 4) ÜRÜN / GÜNLÜK / SAATLİK / MAHALLE ---------- */
{
  for (const [i, b] of BEKLENEN.items.entries()) {
    const g = r.items[i];
    check(`ürün #${i + 1} ${b.id} (${b.qty} adet, ₺${b.revenue})`, g?.id === b.id && g?.qty === b.qty && g?.revenue === b.revenue, JSON.stringify(g));
  }
  esit("günlük satır sayısı", BEKLENEN.daily.length, r.daily.length);
  for (const b of BEKLENEN.daily) {
    const g = r.daily.find((x) => x.date === b.date);
    check(`günlük ${b.date}: ${b.orders} sipariş ₺${b.revenue}`, g?.orders === b.orders && g?.revenue === b.revenue, JSON.stringify(g));
  }
  for (const b of BEKLENEN.hourly) {
    const g = r.hourly.find((x) => x.hour === b.hour);
    check(`saat ${String(b.hour).padStart(2, "0")}: ${b.orders} sipariş`, g?.orders === b.orders, JSON.stringify(g));
  }
  for (const b of BEKLENEN.zones) {
    const g = r.zones.find((x) => x.zone === b.zone);
    check(`mahalle ${b.zone}: ${b.orders} sipariş ₺${b.revenue}`, g?.orders === b.orders && g?.revenue === b.revenue, JSON.stringify(g));
  }
}

/* ---------- 5) GÜN SINIRI (İstanbul) ----------
   E = 16 Eyl 23:50 TR (= 20:50 UTC) → 16'sına yazılmalı
   F = 17 Eyl 00:10 TR (= 16 Eyl 21:10 UTC) → 17'sine yazılmalı.
   UTC'ye göre gruplansaydı İKİSİ de 16 Eyl'e düşerdi. */
{
  const g16 = await (await api("from=2026-09-16&to=2026-09-16")).json();
  esit("16 Eyl: sipariş", BEKLENEN_16.orders, g16.summary.orders);
  esit("16 Eyl: ciro (23:50 buraya)", BEKLENEN_16.revenue, g16.summary.revenue);
  const g17 = await (await api("from=2026-09-17&to=2026-09-17")).json();
  esit("17 Eyl: sipariş (00:10 buraya)", BEKLENEN_17.orders, g17.summary.orders);
  esit("17 Eyl: ciro", BEKLENEN_17.revenue, g17.summary.revenue);
  check("00:10 siparişi 16'ya DEĞİL 17'ye yazıldı", g16.summary.orders === 2 && g17.summary.orders === 1, `16=${g16.summary.orders} 17=${g17.summary.orders}`);
  const s16 = g16.hourly.find((h) => h.hour === 23);
  check("16 Eyl saat 23 dilimi dolu", s16?.orders === 1, JSON.stringify(g16.hourly));
  const s17 = g17.hourly.find((h) => h.hour === 0);
  check("17 Eyl saat 00 dilimi dolu", s17?.orders === 1, JSON.stringify(g17.hourly));
}

/* ---------- 6) HATALI ARALIK ---------- */
{
  esit("bozuk tarih reddedilir", 400, (await api("from=15-09-2026&to=2026-09-17")).status);
  esit("from > to reddedilir", 400, (await api("from=2026-09-18&to=2026-09-15")).status);
}

/* ---------- 7) CSV ---------- */
{
  const res = await api(`from=${BEKLENEN.from}&to=${BEKLENEN.to}&format=csv`);
  esit("CSV HTTP", 200, res.status);
  check("content-type CSV", (res.headers.get("content-type") || "").includes("text/csv"), res.headers.get("content-type"));
  check("dosya adı verilmiş", (res.headers.get("content-disposition") || "").includes("attachment"), res.headers.get("content-disposition"));
  /* BOM BAYT düzeyinde kontrol edilir: res.text() UTF-8 çözerken BOM'u yutar,
     bu yüzden charCodeAt(0) ile bakmak yanlış sonuç verir (dosyada BOM olsa bile). */
  const ham = new Uint8Array(await res.clone().arrayBuffer());
  check("UTF-8 BOM var (Excel Türkçe karakter)", ham[0] === 0xef && ham[1] === 0xbb && ham[2] === 0xbf, `ilk baytlar: ${ham[0]} ${ham[1]} ${ham[2]}`);
  const metin = await res.text();
  const satirlar = metin.replace(/^﻿/, "").trim().split("\n");
  check("sep=; satırı var (Excel ayırıcı)", satirlar[0] === "sep=;", satirlar[0]);
  const bas = satirlar[1].split(";");
  check("başlıkta 9 kolon", bas.length === 9, String(bas.length));
  check("başlık Türkçe bozulmamış", bas.includes("müşteri") && bas.includes("teslimat türü") && bas.includes("sipariş no"), satirlar[1]);
  /* Türkçe harfler gerçekten UTF-8 baytı mı (ş = C5 9F, ü = C3 BC, ₺ = E2 82 BA) */
  const hex = [...ham.slice(0, 200)].map((b) => b.toString(16).padStart(2, "0")).join("");
  check("ş harfi UTF-8 baytı (c59f)", hex.includes("c59f"), "");
  check("ü harfi UTF-8 baytı (c3bc)", hex.includes("c3bc"), "");
  check("₺ simgesi UTF-8 baytı (e282ba)", [...ham].map((b) => b.toString(16).padStart(2, "0")).join("").includes("e282ba"), "");
  /* 7 siparişin hepsi (iptal dahil) listelenir: muhasebe iptali de görmeli */
  esit("CSV satır sayısı (başlık+sep hariç)", SIPARISLER.length, satirlar.length - 2);
  check("iptal satırı 'iptal' durumuyla var", metin.includes("iptal"), "");
  check("mahalle adı çözümlenmiş (Fethiye Merkez)", metin.includes("Fethiye Merkez"), "");
  check("telefon metin olarak (baştaki 0 korunur)", metin.includes('="05001112233"'), "");
  check("ürün satırı okunur biçimde", /\d+× SMOOKY/.test(metin), "");
}

/* ---------- 8) ARAYÜZ ---------- */
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  await page.goto(base + "/panel");
  /* Giriş: anahtar modunda tek parola alanı + gönder (PanelApp > Login) */
  await page.fill(".login input[type=password]", KEY);
  await page.click(".login button[type=submit]");
  await page.waitForSelector(".tabs", { timeout: 15000 });
  await page.click('[role="tab"]:has-text("Raporlar")');
  await page.waitForSelector("[data-reports]", { timeout: 10000 });

  /* Varsayılan son 7 gün; sabit veri eski tarihli olduğu için özel aralık seçilir */
  await page.click('[data-rp-short="custom"]');
  await page.fill("[data-rp-from]", BEKLENEN.from);
  await page.fill("[data-rp-to]", BEKLENEN.to);
  await page.click("[data-rp-apply]");
  await page.waitForFunction(() => !document.querySelector("[data-rp-loading]"), { timeout: 10000 });

  const oku = async (sel, attr) => await page.getAttribute(sel, attr);
  esit("arayüz: sipariş sayısı", String(BEKLENEN.summary.orders), await oku("[data-rp-orders]", "data-rp-orders"));
  esit("arayüz: ciro", String(BEKLENEN.summary.revenue), await oku("[data-rp-revenue]", "data-rp-revenue"));
  esit("arayüz: ortalama sepet", String(BEKLENEN.ortalama), await oku("[data-rp-avg]", "data-rp-avg"));
  esit("arayüz: iptal", String(BEKLENEN.summary.cancelled), await oku("[data-rp-cancelled]", "data-rp-cancelled"));
  const ilk = await page.getAttribute("[data-rp-items] li:first-child", "data-rp-item");
  esit("arayüz: en çok satan ilk sıra", BEKLENEN.items[0].id, ilk);
  check("arayüz: günlük kırılım 3 gün", (await page.$$("[data-rp-daily] li")).length === 3, "");
  check("arayüz: saatlik kırılım dolu", (await page.$$("[data-rp-hourly] li")).length === BEKLENEN.hourly.length, "");
  check("arayüz: mahalle listesi dolu", (await page.$$("[data-rp-zones] li")).length === BEKLENEN.zones.length, "");
  check("arayüz: CSV butonu var", !!(await page.$("[data-rp-csv]")), "");

  await mkdir("docs/screens/raporlar", { recursive: true });
  await page.screenshot({ path: "docs/screens/raporlar/panel-1000.png", fullPage: true });

  /* Kısayol: Bugün → sabit veri eski olduğu için boş sonuç dönmeli */
  await page.click('[data-rp-short="today"]');
  await page.waitForFunction(() => !document.querySelector("[data-rp-loading]"), { timeout: 10000 });
  check("kısayol 'Bugün' çalışıyor (bu aralıkta veri yok)", !!(await page.$("[data-rp-empty]")), "");

  await browser.close();
}

/* Temizlik: stub deposunu boşalt (diğer paketler etkilenmesin) */
await rm(path.join(DIR, "orders.json"), { force: true });

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
