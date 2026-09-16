/**
 * e2e paket koşucusu — HER ZAMAN yerel stub depoyla çalışır.
 *
 * Kullanım:
 *   node scripts/run-e2e.mjs                 # tüm paket
 *   node scripts/run-e2e.mjs panel push      # yalnız bu testler
 *
 * Canlı veritabanı kilidi: önce scripts/test-guard.mjs koşar. Sunucu canlı
 * Supabase'e bağlıysa tek bir test bile başlamaz.
 */
import { readdirSync, rmSync } from "node:fs";
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
const NEEDS_CLEAN = new Set(["panel", "faz3", "faz5-mobile-payment", "supabase-proof"]);

async function restartServerClean() {
  spawnSync("bash", ["-c", "kill -9 $(lsof -tiTCP:3112 -sTCP:LISTEN) 2>/dev/null; true"]);
  rmSync(".data", { recursive: true, force: true });
  const child = spawn(process.execPath, ["scripts/test-server.mjs"], { detached: true, stdio: "ignore", env: { ...process.env, MAG_KEEP_DATA: "" } });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const ok = await fetch(BASE + "/api/panel/me").then((r) => r.ok).catch(() => false);
    if (ok) return true;
  }
  return false;
}

const rows = [];
for (const n of files) {
  if (NEEDS_CLEAN.has(n) && !process.env.MAG_KEEP_DATA) {
    if (!(await restartServerClean())) { console.log(`${n}: sunucu yeniden başlatılamadı`); }
  }
  const r = spawnSync(
    process.execPath,
    ["--import", "./tests/e2e/_alias-loader.mjs", `tests/e2e/${n}.mjs`, BASE],
    { encoding: "utf8", env: process.env, maxBuffer: 1e8 },
  );
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = (out.match(/^PASS/gm) || []).length;
  const fail = (out.match(/^FAIL/gm) || []).length;
  const skipped = /normal pakette atlanır/.test(out);
  rows.push({ n, code: r.status, pass, fail, skipped, out });
  const tag = skipped ? "ATLANDI" : r.status === 0 ? "GEÇTİ" : "DÜŞTÜ";
  console.log(`${n.padEnd(24)} ${String(tag).padEnd(8)} PASS=${String(pass).padEnd(4)} FAIL=${fail}`);
}

const bad = rows.filter((r) => r.code !== 0 && !r.skipped);
console.log(`\n${rows.length} paket · geçen ${rows.filter((r) => r.code === 0 && !r.skipped).length} · düşen ${bad.length} · atlanan ${rows.filter((r) => r.skipped).length}`);
for (const b of bad) {
  console.log(`\n--- ${b.n} son satırlar ---`);
  console.log(b.out.trim().split("\n").slice(-12).join("\n"));
}
process.exit(bad.length ? 1 : 0);
