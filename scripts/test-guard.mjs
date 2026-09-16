/**
 * CANLI VERİTABANI KİLİDİ — testlerin canlı Supabase'e yazmasını engeller.
 *
 * Neden: e2e testleri gerçek sipariş oluşturuyor. Sunucu .env.local ile
 * başlatılırsa depo Supabase'e düşer ve test siparişleri CANLI orders tablosuna
 * yazılır (15 Eyl 2026'da 168 test kaydı böyle birikti).
 *
 * Kilit iki yönlü çalışır:
 *   1) Bu süreçte canlı bir Supabase anahtarı görünüyorsa hemen durur.
 *   2) Hedef sunucuya sorar (/api/panel/me): depo "supabase" ise durur.
 *      Böylece testi doğru env ile başlatıp SUNUCUYU yanlış env ile başlatma
 *      hatası da yakalanır — asıl tehlike budur.
 *
 * Kasıtlı olarak canlıya karşı koşmak gerekiyorsa (normalde ASLA):
 *   MAG_ALLOW_LIVE_DB=1
 */

const RED = "\x1b[31m", BOLD = "\x1b[1m", OFF = "\x1b[0m";

function die(reason, detail) {
  console.error(`\n${RED}${BOLD}canlı veritabanına test çalıştırılamaz${OFF}\n`);
  console.error(`  sebep : ${reason}`);
  if (detail) console.error(`  ayrıntı: ${detail}`);
  console.error(`
  Testler yerel stub depoyla (.data/*.json) çalışmalıdır.
  Doğru kullanım:
      pnpm test:server     # sunucuyu .env.test ile başlatır
      pnpm test            # testleri .env.test ile koşar

  Sunucuyu elle başlattıysan .env.local ile başlatmış olabilirsin;
  onu durdurup 'pnpm test:server' kullan.
`);
  process.exit(1);
}

/** Bu süreçte canlı Supabase anahtarı tanımlı mı? */
export function assertNoLiveEnv() {
  if (process.env.MAG_ALLOW_LIVE_DB === "1") {
    console.warn("⚠️  MAG_ALLOW_LIVE_DB=1 — canlı veritabanı kilidi BİLEREK açık");
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (url.trim() || key.trim()) {
    let host = url;
    try { host = new URL(url).host; } catch { /* boş ya da bozuk URL */ }
    die("test sürecinde Supabase anahtarı tanımlı", `SUPABASE_URL=${host || "(boş ama service key dolu)"}`);
  }
}

/** Hedef sunucu hangi depoyu kullanıyor? Supabase ise durdur. */
export async function assertServerUsesStub(base) {
  if (process.env.MAG_ALLOW_LIVE_DB === "1") return;
  let mode;
  try {
    const r = await fetch(base + "/api/panel/me");
    mode = (await r.json()).store;
  } catch (e) {
    die("sunucuya ulaşılamadı", `${base} — önce 'pnpm test:server' ile başlat (${e.message})`);
  }
  if (mode !== "stub") {
    die("sunucu CANLI Supabase'e bağlı", `/api/panel/me → store="${mode}" (beklenen: "stub")`);
  }
}

/** Testlerin başında tek çağrı. */
export async function guard(base) {
  assertNoLiveEnv();
  await assertServerUsesStub(base);
}

// Doğrudan çalıştırılırsa (pnpm test öncesi ön kontrol)
if (import.meta.url === `file://${process.argv[1]}`) {
  assertNoLiveEnv();
  const base = process.argv[2];
  if (base) await assertServerUsesStub(base);
  console.log("✓ canlı veritabanı kilidi geçildi — depo: stub");
}
