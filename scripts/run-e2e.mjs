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
/* Grup alt süreçleri kilide takılmaz: kilidi ÜST koşucu tutuyor ve gruplar
   sırayla koşuyor, yani eşzamanlılık yok. */
if (existsSync(LOCK) && !process.env.MAG_FORCE && !process.env.MAG_GROUP) {
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
if (!process.env.MAG_GROUP) writeFileSync(LOCK, String(process.pid));
const kilidiBirak = () => { if (process.env.MAG_GROUP) return; try { rmSync(LOCK, { force: true }); } catch {} };
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
const NEEDS_CLEAN = new Set(["panel", "faz3", "faz5-mobile-payment", "supabase-proof", "raporlar", "settings-koruma", "panel-fiyat-akisi", "teslimat-tipi"]);
/* Kendi verisini bırakan paketler: sonrasında depo sıfırlanır. */
const DIRTIES = new Set(["raporlar", "settings-koruma", "panel-fiyat-akisi", "teslimat-tipi"]);

/**
 * Sunucuyu TEMİZ yeniden başlat.
 *
 * YETİM SÜREÇ DÜZELTMESİ (25 Eyl 2026): eskiden yalnız PORTU DİNLEYEN süreç
 * öldürülüyordu. Ama `test-server.mjs` bir sarmalayıcı; asıl işi ÇOCUĞU olan
 * `next-server` yapıyor. Dinleyici ölünce çocuk YETİM kalıp yaşamaya devam
 * ediyordu. Tam koşuda NEEDS_CLEAN paketleri için bu 7+ kez tekrarlanınca
 * arkada birikmiş next-server süreçleri belleği yiyor ve rastgele paketler
 * çöküyordu ("DÜŞTÜ ama FAIL=0"). Ölçüldü: koşu sonrası 3 next-server ayakta,
 * ikisi yetim (ppid başka koşulardan).
 * Artık önce sarmalayıcı + tüm next-server süreçleri temizleniyor, sonra port.
 */
async function restartServerClean() {
  spawnSync("bash", ["-c", "pkill -9 -f 'scripts/test-server.mjs' 2>/dev/null; pkill -9 -f 'next-server' 2>/dev/null; kill -9 $(lsof -tiTCP:3112 -sTCP:LISTEN) 2>/dev/null; true"]);
  /* Portun gerçekten boşalmasını bekle: hemen yeniden başlatılırsa yeni sunucu
     "address in use" ile ölüyor ve paketler sunucusuz kalıyordu. */
  for (let i = 0; i < 40; i++) {
    const mesgul = spawnSync("bash", ["-c", "lsof -tiTCP:3112 -sTCP:LISTEN | head -1"], { encoding: "utf8" }).stdout.trim();
    if (!mesgul) break;
    await new Promise((r) => setTimeout(r, 250));
  }
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

/* ---------------------------------------------------------------------------
   GRUP MODU (25 Eyl 2026) — paketleri 6'lık gruplara böl, HER GRUBU AYRI bir
   koşucu sürecinde çalıştır. Grup bitince süreç kapanır, o gruba ait ne varsa
   (node yığını, playwright sürücü bağlantıları, sunucu yeniden başlatmalarından
   kalan artıklar) işletim sistemine iade edilir.

   Neden: tam koşuda arka arkaya ~34 paket tek koşucu sürecinden yönetiliyordu;
   bellek baskısı arttıkça rastgele paketler "DÜŞTÜ ama FAIL=0" ile yarıda
   kesiliyordu — her koşuda BAŞKA paket. Test mantığına DOKUNULMADI; yalnız
   koşum düzeni değişti.

   MAG_GROUP verilirse bu süreç TEK bir grubu koşan alt süreçtir (aşağıdaki
   normal akış işler). Verilmezse ve paket seçilmemişse: bölüştür ve yönet. */
/**
 * Sistem yükü inene kadar bekle (en fazla `enFazlaSn`).
 *
 * Neden: zamanlama ölçen paketler (preloader, outro-loop, cart-fx) animasyonu
 * kare kare örnekliyor. Yüklü makinede tarayıcı kare atlıyor ve bu paketler
 * ÜRÜNDE HATA OLMADAN düşüyor — ölçüldü: yük ~7'de 1 düşen, ~20'de 10,
 * ~110'da 20. Ayrıca arka arkaya koşulan turlar makineyi kendileri ısıtıyor:
 * bir tur yükü 6'dan 17'ye çıkarıp sonrakinin koşullarını bozabiliyor.
 *
 * Yük inmezse ENGELLEMEZ: uyarı basıp devam eder — koşuyu durdurmak, sahte
 * düşmeden daha kötü olurdu. Sadece sonucu yorumlayan kişi uyarılmış olur.
 */
function yukOrtalamasi() {
  const o = spawnSync("bash", ["-c", "uptime | sed 's/.*averages: //' | awk '{print $1}'"], { encoding: "utf8" });
  return Number.parseFloat((o.stdout || "").trim()) || 0;
}
async function yukDusenekadarBekle(esik = 15, enFazlaSn = 300) {
  const bas = Date.now();
  let y = yukOrtalamasi();
  if (y < esik) return;
  console.log(`yük ${y.toFixed(2)} — ${esik} altına inmesi bekleniyor (en fazla ${enFazlaSn} sn)`);
  while ((Date.now() - bas) / 1000 < enFazlaSn) {
    await new Promise((r) => setTimeout(r, 15_000));
    y = yukOrtalamasi();
    if (y < esik) { console.log(`yük ${y.toFixed(2)} — devam`); return; }
  }
  console.log(`⚠️  yük hâlâ ${y.toFixed(2)} (${esik} altına inmedi) — yine de koşuluyor.`);
  console.log(`   Zamanlama paketleri (preloader, outro-loop, cart-fx) bu yükte ÜRÜN HATASI OLMADAN düşebilir.`);
}

const GRUP_BOYU = Number(process.env.MAG_GROUP_SIZE || 6);
if (!process.env.MAG_GROUP && only.length === 0 && files.length > GRUP_BOYU) {
  const gruplar = [];
  for (let i = 0; i < files.length; i += GRUP_BOYU) gruplar.push(files.slice(i, i + GRUP_BOYU));

  const bosBellek = () => {
    const o = spawnSync("bash", ["-c", "vm_stat | awk '/Pages free/{gsub(/\\./,\"\",$3); f=$3} /Pages inactive/{gsub(/\\./,\"\",$3); i=$3} END{printf \"%.0f/%.0f\", f*16384/1048576, i*16384/1048576}'"], { encoding: "utf8" });
    return (o.stdout || "?").trim();
  };

  await yukDusenekadarBekle();
  console.log(`${files.length} paket · ${gruplar.length} grup (grup başına ${GRUP_BOYU}) · her grup ayrı süreçte`);
  console.log(`boş bellek (serbest/etkisiz MB) — başlangıç: ${bosBellek()}\n`);

  let toplamGecen = 0, toplamDusen = 0, toplamAtlanan = 0, toplamTekrar = 0;
  const dusenler = [];
  for (const [i, g] of gruplar.entries()) {
    /* Gruplar arasında da bekle: önceki grup makineyi ısıtmış olabiliyor. */
    if (i > 0) await yukDusenekadarBekle();
    const r = spawnSync(process.execPath, ["scripts/run-e2e.mjs", ...g], {
      encoding: "utf8", maxBuffer: 1e8,
      env: { ...process.env, MAG_GROUP: String(i + 1) },
    });
    const out = (r.stdout || "") + (r.stderr || "");
    process.stdout.write(out.split("\n").filter((l) => /GEÇTİ|DÜŞTÜ|ATLANDI|tekrarlanıyor/.test(l)).join("\n") + "\n");
    const m = out.match(/(\d+) paket · geçen (\d+) · düşen (\d+) · atlanan (\d+)/);
    if (m) { toplamGecen += +m[2]; toplamDusen += +m[3]; toplamAtlanan += +m[4]; }
    toplamTekrar += (out.match(/tekrarlanıyor/g) || []).length;
    for (const l of out.split("\n")) { const d = l.match(/^(\S+)\s+DÜŞTÜ/); if (d) dusenler.push(d[1]); }
    console.log(`  grup ${i + 1}/${gruplar.length} bitti — boş bellek: ${bosBellek()}`);
  }

  console.log(`\n${files.length} paket · geçen ${toplamGecen} · düşen ${toplamDusen} · atlanan ${toplamAtlanan}`);
  console.log(`tekrarlanan paket sayısı: ${toplamTekrar}`);
  console.log(`boş bellek — bitiş: ${bosBellek()}`);
  if (dusenler.length) console.log(`düşen paketler: ${dusenler.join(", ")}`);
  process.exit(toplamDusen ? 1 : 0);
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
