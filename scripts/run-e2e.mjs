/**
 * e2e paket koşucusu — HER ZAMAN yerel stub depoyla çalışır.
 *
 * Kullanım:
 *   node scripts/run-e2e.mjs                 # tüm paket
 *   node scripts/run-e2e.mjs panel faz3      # yalnız bu testler
 *
 * Canlı veritabanı kilidi: önce scripts/test-guard.mjs koşar. Sunucu canlı
 * Supabase'e bağlıysa tek bir test bile başlamaz.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { assertNoLiveEnv, assertServerUsesStub } from "./test-guard.mjs";

const BASE = process.env.MAG_TEST_BASE || "http://localhost:3112";
const only = process.argv.slice(2);

assertNoLiveEnv();
await assertServerUsesStub(BASE);

/* Depo TEMİZ olmalı. MAG_FAKE_NOW zamanı dondurduğu için her sipariş aynı
   created_at ile yazılıyor; kayıtlar birikince panel yeni siparişi listenin
   başında göstermiyor ve panel/faz3/faz5 testleri düşüyor.
   Stub deposu dosyayı BELLEKTE önbelleğe aldığı için .data'yı silmek tek başına
   yetmez — uyarı verip kullanıcıyı sunucuyu yeniden başlatmaya yönlendiriyoruz. */
const existing = await fetch(BASE + "/api/orders?limit=1")
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => (Array.isArray(j) ? j.length : Array.isArray(j?.orders) ? j.orders.length : 0))
  .catch(() => 0);
if (existing > 0 && !process.env.MAG_KEEP_DATA) {
  console.log(`⚠️  depoda önceki koşulardan kayıt var — panel/faz3/faz5 düşebilir.`);
  console.log(`   Temiz koşu için:  rm -rf .data && pnpm test:server  (sonra tekrar 'pnpm test')\n`);
}
/* EŞZAMANLI KOŞU KİLİDİ (24 Eyl 2026).
   Paketler TEK sunucuyu (3112) paylaşıyor ve NEEDS_CLEAN olanlar onu yeniden
   BAŞLATIYOR. İki koşu üst üste binince biri diğerinin sunucusunu altından
   çekiyor; sonuç "FAIL=0 ama DÜŞTÜ" şeklinde yarıda kalan paketler oluyor ve
   her koşuda BAŞKA paketler düşüyor — gerçek bir hata sanılıyor.
   Ölçüldü: rahatsız edilmeyen tam koşu 34/34 geçti; aynı anda başka paket
   koşarken yapılan iki turda 4 ve 6 paket "düştü", çoğu FAIL=0 ile.
   Bu kilit ikinci koşuyu net bir mesajla durdurur. */
const LOCK = ".e2e-lock";
if (existsSync(LOCK) && !process.env.MAG_FORCE) {
  const sahip = readFileSync(LOCK, "utf8").trim();
  let canli = false;
  try { process.kill(Number(sahip), 0); canli = true; } catch { canli = false; }
  if (canli) {
    console.error(`\n⛔ Zaten bir e2e koşusu var (pid ${sahip}). Paketler aynı sunucuyu paylaşıyor;`);
    console.error(`   ikinci koşu ilkinin sunucusunu yeniden başlatır ve İKİSİ de bozulur.`);
    console.error(`   Bitmesini bekle. Kilit takıldıysa: rm ${LOCK}\n`);
    process.exit(2);
  }
  /* sahibi ölmüş: bayat kilit, devral */
}
writeFileSync(LOCK, String(process.pid));
const kilidiBirak = () => { try { rmSync(LOCK, { force: true }); } catch {} };
process.on("exit", kilidiBirak);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { kilidiBirak(); process.exit(130); });

console.log(`✓ depo: stub — canlı veritabanına yazılmayacak (${BASE})\n`);

const files = readdirSync("tests/e2e")
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((n) => (only.length ? only.includes(n) : true))
  .sort();

/* Sipariş yazan testler, ÖNCEKİ testlerin kayıtlarıyla dolu bir panelde koşarsa
   düşüyor: MAG_FAKE_NOW zamanı dondurduğu için tüm kayıtlar aynı created_at'i
   alıyor ve yeni sipariş listede beklenen yerde çıkmıyor. Bu testlerden önce
   sunucu temiz depoyla yeniden başlatılır. */
/* raporlar: .data/orders.json'a SABİT veri yazıp okuyor. Stub dosyayı bellekte
   önbelleğe aldığı için sunucunun o dosyayı HENÜZ okumamış olması gerekiyor —
   temiz yeniden başlatma bunu garantiliyor. Ayrıca kendi kayıtlarını bırakıp
   sonraki paketleri bozmasın diye sonrasında da depo sıfırlanmalı. */
/* settings-koruma / panel-fiyat-akisi: AYAR satırını (prices, zones, schedule)
   yazıp değiştiriyorlar. Kendi başlangıç haritalarını kurdukları için temiz
   depoyla başlamaları, bıraktıkları ayarların sonraki paketleri (fiyat okuyan
   her şey) bozmaması için de sonrasında sıfırlanmaları gerekiyor. */
const NEEDS_CLEAN = new Set(["panel", "faz3", "faz5-mobile-payment", "supabase-proof", "raporlar", "settings-koruma", "panel-fiyat-akisi"]);
/* Kendi verisini bırakan paketler: sonrasında depo sıfırlanır. */
const DIRTIES = new Set(["raporlar", "settings-koruma", "panel-fiyat-akisi"]);

async function restartServerClean() {
  spawnSync("bash", ["-c", "kill -9 $(lsof -tiTCP:3112 -sTCP:LISTEN) 2>/dev/null; true"]);
  rmSync(".data", { recursive: true, force: true });
  const child = spawn(process.execPath, ["scripts/test-server.mjs"], { detached: true, stdio: "ignore", env: { ...process.env, MAG_KEEP_DATA: "" } });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const ok = await fetch(BASE + "/api/panel/me").then((r) => r.ok).catch(() => false);
    if (ok) { await warmRoutes(); return true; }
  }
  return false;
}

/**
 * Rotaları ISIT. `/api/panel/me` cevap veriyor diye sunucu HAZIR sayılamaz:
 * o yalnız BİR rotanın hazır olduğunu gösterir. Isıtılmazsa ilk isteği yapan
 * paket, kendi zamanlama ölçümlerinin içinde rota maliyetini de ödüyor ve
 * sahte düşme üretiyor. Ölçüm ve kanıt için: testten ÖNCE ısıt, sonra ölç.
 */
async function warmRoutes() {
  const yollar = ["/", "/siparis", "/siparis/odeme", "/panel", "/galeri", "/iletisim", "/en/siparis", "/ru/siparis", "/api/panel/settings", "/api/orders?limit=1"];
  await Promise.all(yollar.map((u) => fetch(BASE + u).then((r) => r.arrayBuffer()).catch(() => {})));
}

/* İLK paketten önce de ısıt: restartServerClean yalnız NEEDS_CLEAN paketleri
   için koşuyor, dolayısıyla listenin başındaki paket soğuk sunucuya düşebilir. */
await warmRoutes();

const rows = [];
for (const n of files) {
  if (NEEDS_CLEAN.has(n) && !process.env.MAG_KEEP_DATA) {
    if (!(await restartServerClean())) { console.log(`${n}: sunucu yeniden başlatılamadı`); }
  }
  const kos = () =>
    spawnSync(
      process.execPath,
      ["--import", "./tests/e2e/_alias-loader.mjs", `tests/e2e/${n}.mjs`, BASE],
      { encoding: "utf8", env: process.env, maxBuffer: 1e8 },
    );
  let r = kos();
  let out = (r.stdout || "") + (r.stderr || "");
  let pass = (out.match(/^PASS/gm) || []).length;
  let fail = (out.match(/^FAIL/gm) || []).length;
  /* YARIDA KESİLEN PAKETİ BİR KEZ TEKRARLA.
     "Çıkış kodu != 0 ama hiç FAIL yok" = paket bir kontrolü düşürmedi, ortam
     yüzünden ÇÖKTÜ (tipik olarak Chromium başlatılamadı). Bu makinede 8 GB
     RAM'in ~60 MB'ı boşta; tam pakette arka arkaya ~34 tarayıcı açılınca bellek
     baskısı rastgele paketleri düşürüyordu — her koşuda BAŞKA paket, hep FAIL=0.
     Gerçek bir kontrol düştüyse (fail > 0) TEKRARLANMAZ: hatayı gizlemeyelim. */
  if (r.status !== 0 && fail === 0 && !/normal pakette atlanır/.test(out)) {
    console.log(`${n.padEnd(24)} yarıda kesildi (FAIL=0) — bir kez tekrarlanıyor`);
    await new Promise((res) => setTimeout(res, 2000));
    const r2 = kos();
    const out2 = (r2.stdout || "") + (r2.stderr || "");
    if (r2.status === 0 || (out2.match(/^FAIL/gm) || []).length > 0) {
      r = r2; out = out2;
      pass = (out.match(/^PASS/gm) || []).length;
      fail = (out.match(/^FAIL/gm) || []).length;
    }
  }
  const skipped = /normal pakette atlanır/.test(out);
  rows.push({ n, code: r.status, pass, fail, skipped, out });
  const tag = skipped ? "ATLANDI" : r.status === 0 ? "GEÇTİ" : "DÜŞTÜ";
  console.log(`${n.padEnd(24)} ${String(tag).padEnd(8)} PASS=${String(pass).padEnd(4)} FAIL=${fail}`);
  /* Kendi verisini bırakan paketten SONRA depoyu sıfırla: sonraki paketler
     (cart-fx, panel…) dolu depoda düşüyordu. */
  if (DIRTIES.has(n) && !process.env.MAG_KEEP_DATA) await restartServerClean();
}

const bad = rows.filter((r) => r.code !== 0 && !r.skipped);
console.log(`\n${rows.length} paket · geçen ${rows.filter((r) => r.code === 0 && !r.skipped).length} · düşen ${bad.length} · atlanan ${rows.filter((r) => r.skipped).length}`);
for (const b of bad) {
  console.log(`\n--- ${b.n} son satırlar ---`);
  console.log(b.out.trim().split("\n").slice(-12).join("\n"));
}
process.exit(bad.length ? 1 : 0);
