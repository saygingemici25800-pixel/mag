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
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertNoLiveEnv, assertServerUsesStub } from "./test-guard.mjs";

const BASE = process.env.MAG_TEST_BASE || "http://localhost:3112";
const only = process.argv.slice(2);

assertNoLiveEnv();
await assertServerUsesStub(BASE);
console.log(`✓ depo: stub — canlı veritabanına yazılmayacak (${BASE})\n`);

const files = readdirSync("tests/e2e")
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((n) => (only.length ? only.includes(n) : true))
  .sort();

const rows = [];
for (const n of files) {
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
