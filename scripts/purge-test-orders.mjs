/**
 * Canlı orders tablosundaki TEST kayıtlarını yedekleyip siler.
 *
 * Güvenlik: bir kaydın test olduğunu KANITLAMADAN silmez. Ölçüt (hepsi birden):
 *   - ÖDEME İZİ SAHTE: payment_ref "mock:" ile başlar (gerçek iyzico işlemi
 *     değil) YA DA kayıt WhatsApp kanalından gelmiş (status="whatsapp" ve
 *     payment_ref hiç yok — bu kanalda ödeme sunucudan geçmiyor), VE
 *   - ad bilinen test adlarından biri, VE
 *   - telefon bilinen test numaralarından biri
 * Bu üçünden biri bile tutmayan kayıt ŞÜPHELİ sayılır, SİLİNMEZ ve raporlanır.
 *
 * WhatsApp kanalı GERÇEK müşteri de yaratıyor; onu tek başına "test" saymak
 * tehlikeli olurdu. Bu yüzden ad + telefon ölçütleri AYNEN duruyor: gerçek bir
 * WhatsApp siparişi test adı/numarası taşımayacağı için şüpheli kalır, silinmez.
 *
 * Kullanım:
 *   node scripts/purge-test-orders.mjs            # yalnız RAPOR (silmez)
 *   node scripts/purge-test-orders.mjs --apply    # yedekle + sil
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim();
}

const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok — .env.local okunamadı.");
  process.exit(1);
}
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const APPLY = process.argv.includes("--apply");

/* Bilinen test imzaları — 15 Eyl 2026 dökümünden çıkarıldı. */
const TEST_NAMES = new Set([
  "Hazirlik Kontrol", "Test Müşteri", "Panel Test", "Malzeme Test", "Mobil Ödeme",
  "Klavye Test", "Test Kullanıcı", "Test Kullanici", "Supabase Kanit",
  "Push Derin Baglanti", "Gel Al", "Canlı Test", "Probe",
  /* 21 Eyl 2026 — WhatsApp kanalının canlı doğrulaması */
  "Canli Dogrulama",
  /* 25 Eyl 2026 — canlı smoke testi (tests/e2e/smoke-canli.mjs) */
  "Smoke Test",
]);
const TEST_PHONES = new Set([
  "+905321234567", "+905327778899", "+905321112233", "+905334445566",
  "+905555555555", "+905329998877", "+905320000000",
]);

const all = await fetch(`${URL_}/rest/v1/orders?select=*&order=created_at.asc`, { headers: H }).then((r) => r.json());
console.log(`canlı orders tablosu — SİLME ÖNCESİ kayıt sayısı: ${all.length}`);

const reasons = (o) => {
  const bad = [];
  /* Sahte ödeme izi: mock ödeme YA DA WhatsApp kanalı (o kanalda payment_ref hiç yazılmıyor). */
  const sahteOdeme =
    String(o.payment_ref || "").startsWith("mock:") || (o.status === "whatsapp" && !o.payment_ref);
  if (!sahteOdeme) bad.push(`payment_ref="${o.payment_ref}" (mock: değil, WhatsApp kanalı da değil)`);
  if (!TEST_NAMES.has(o.name)) bad.push(`ad="${o.name}" (bilinen test adı değil)`);
  if (!TEST_PHONES.has(o.phone)) bad.push(`telefon="${o.phone}" (bilinen test numarası değil)`);
  return bad;
};

const suspicious = [], testRows = [];
for (const o of all) (reasons(o).length ? suspicious : testRows).push(o);

if (suspicious.length) {
  console.log(`\n⚠️  ŞÜPHELİ ${suspicious.length} kayıt — GERÇEK MÜŞTERİ OLABİLİR, SİLİNMEYECEK:`);
  for (const o of suspicious) {
    console.log(`  ${o.created_at}  ${o.name}  ${o.phone}  ₺${o.total}  ${o.status}`);
    console.log(`     sebep: ${reasons(o).join(" · ")}`);
  }
} else {
  console.log("\n✓ şüpheli kayıt yok — tüm kayıtlar üç ölçütü de sağlıyor (mock ödeme + test adı + test telefonu)");
}
console.log(`\ntest olduğu kanıtlanan: ${testRows.length} kayıt`);

if (!APPLY) {
  console.log("\n(rapor modu — hiçbir şey silinmedi. Silmek için: --apply)");
  process.exit(0);
}
if (!testRows.length) { console.log("silinecek kayıt yok."); process.exit(0); }

/* 1) YEDEK — silmeden önce, gitignore'lu klasöre */
mkdirSync("docs/backup", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = `docs/backup/orders-${stamp}.json`;
writeFileSync(file, JSON.stringify({
  takenAt: new Date().toISOString(),
  project: new URL(URL_).host,
  totalBefore: all.length,
  deleted: testRows.length,
  keptSuspicious: suspicious.length,
  rows: all,           // ŞÜPHELİLER DE dahil: yedek tam olsun
}, null, 2));
console.log(`yedek yazıldı: ${file} (${all.length} kayıt — şüpheliler dahil)`);

/* 2) SİL — yalnız kanıtlanmış test kayıtları, parça parça */
let done = 0;
for (let i = 0; i < testRows.length; i += 50) {
  const ids = testRows.slice(i, i + 50).map((o) => o.id);
  const q = `${URL_}/rest/v1/orders?id=in.(${ids.map((x) => `"${x}"`).join(",")})`;
  const r = await fetch(q, { method: "DELETE", headers: H });
  if (!r.ok) { console.error("silme hatası", r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  done += ids.length;
  process.stdout.write(`\rsilinen: ${done}/${testRows.length}`);
}
console.log();

/* 3) DOĞRULA */
const after = await fetch(`${URL_}/rest/v1/orders?select=id&limit=1`, { headers: { ...H, prefer: "count=exact" } });
const left = (after.headers.get("content-range") || "").split("/")[1];
console.log(`\ncanlı orders tablosu — SİLME SONRASI kayıt sayısı: ${left}`);
console.log(left === String(suspicious.length) ? "✓ beklenen sonuç" : "⚠️  beklenenden farklı — kontrol et");
