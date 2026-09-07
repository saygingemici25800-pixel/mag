/**
 * Migration uygulayıcı + doğrulayıcı — DATABASE_URL (.env.local) ile Supabase'e bağlanır.
 *
 * GÜVENLİK: bağlantı dizesi hiçbir çıktıya, loga ya da hata mesajına yazılmaz.
 * Hatalar maskelenerek basılır (maskeleme aşağıda `scrub`).
 *
 * Kullanım:
 *   node scripts/db-migrate.mjs          → migration'ları sırayla uygula, sonra doğrula
 *   node scripts/db-migrate.mjs --verify → yalnızca doğrula (yazma yok)
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const VERIFY_ONLY = process.argv.includes("--verify");

/** .env.local'ı oku (repo'da dotenv yok; tek satır ayrıştırıcı yeterli) */
async function loadEnv() {
  try {
    const raw = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* dosya yoksa ortam değişkenine bakılır */
  }
}

/** Bağlantı dizesinin herhangi bir parçası çıktıya sızmasın */
function scrub(s) {
  const url = process.env.DATABASE_URL ?? "";
  let out = String(s);
  if (url) {
    out = out.split(url).join("<DATABASE_URL>");
    try {
      const u = new URL(url);
      for (const secret of [u.password, u.username, u.hostname].filter(Boolean)) {
        if (secret.length > 3) out = out.split(secret).join("<gizli>");
      }
    } catch {
      /* ayrıştırılamazsa yukarıdaki tam eşleşme yeter */
    }
  }
  return out.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "<DATABASE_URL>");
}

const say = (...a) => console.log(...a.map((x) => scrub(x)));

async function main() {
  await loadEnv();
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    say("HATA: DATABASE_URL yok. .env.local içine ekleyin (şifre percent-encode edilmiş olmalı).");
    process.exit(2);
  }

  /* Bağlantıyı ALANLARA ayırarak veriyoruz: connectionString ile pooler kullanıcı adındaki nokta
     (postgres.<proje-ref>) sürücü tarafında "postgres"e kırpılıyor ve kimlik doğrulama düşüyor. */
  let cfg;
  try {
    const u = new URL(conn);
    cfg = {
      host: u.hostname,
      port: Number(u.port || 5432),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    say("HATA: DATABASE_URL ayrıştırılamadı (şifre percent-encode edilmiş olmalı).");
    process.exit(2);
  }

  const client = new pg.Client({
    ...cfg,
    // Supabase pooler TLS ister; sertifika zinciri doğrulaması havuzda sorun çıkarabiliyor
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60_000,
  });

  try {
    await client.connect();
  } catch (e) {
    say("Bağlantı kurulamadı:", scrub(e.message));
    say("İpucu: şifrede @ : / ? # gibi karakter varsa percent-encode edilmeli (@ → %40).");
    process.exit(3);
  }

  const who = await client.query("select current_database() db, current_user usr, version() v");
  say(`Bağlandı · veritabanı=${who.rows[0].db} · kullanıcı=${who.rows[0].usr}`);
  say(`Sunucu: ${who.rows[0].v.split(" ").slice(0, 2).join(" ")}`);

  if (!VERIFY_ONLY) {
    const dir = path.join(ROOT, "supabase", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort(); // 0001, 0002, 0003…
    say(`\n=== Migration (${files.length} dosya, sırayla) ===`);
    for (const f of files) {
      const sql = await readFile(path.join(dir, f), "utf8");
      const t0 = Date.now();
      try {
        await client.query(sql);
        say(`  ✓ ${f}  (${Date.now() - t0} ms)`);
      } catch (e) {
        say(`  ✗ ${f}: ${scrub(e.message)}`);
        await client.end();
        process.exit(4);
      }
    }
  }

  /* ---- doğrulama: SETUP/VERIFY ile aynı kontroller ---- */
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  const tables = await q(
    `select table_name from information_schema.tables
      where table_schema='public' and table_name in ('orders','push_subscriptions','settings')
      order by table_name`,
  );
  const cols = await q(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name='orders'
        and column_name in ('payment_status','payment_ref','locale','prep_minutes','accepted_at','closed_at','cancelled_at')`,
  );
  const rls = await q(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('orders','push_subscriptions','settings') order by c.relname`,
  );
  const pubs = await q(
    `select tablename from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' order by tablename`,
  );
  const policies = await q(
    `select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname`,
  );
  const singleton = await q(`select id, ordering_open, jsonb_array_length(sold_out) as sold_out_count from public.settings where id='singleton'`);
  const counts = await q(`select (select count(*) from public.orders) orders, (select count(*) from public.settings) settings`);

  const has = (arr, key, val) => arr.some((r) => r[key] === val);
  const rows = [
    ["Tablo: orders", has(tables, "table_name", "orders")],
    ["Tablo: push_subscriptions", has(tables, "table_name", "push_subscriptions")],
    ["Tablo: settings", has(tables, "table_name", "settings")],
    ["Kolonlar: ödeme (payment_status, payment_ref, locale)", ["payment_status", "payment_ref", "locale"].every((c) => has(cols, "column_name", c))],
    ["Kolonlar: panel (prep_minutes, accepted_at, closed_at, cancelled_at)", ["prep_minutes", "accepted_at", "closed_at", "cancelled_at"].every((c) => has(cols, "column_name", c))],
    ["RLS: orders", rls.find((r) => r.relname === "orders")?.relrowsecurity === true],
    ["RLS: push_subscriptions", rls.find((r) => r.relname === "push_subscriptions")?.relrowsecurity === true],
    ["RLS: settings", rls.find((r) => r.relname === "settings")?.relrowsecurity === true],
    ["Realtime: orders yayında", has(pubs, "tablename", "orders")],
    ["Realtime: settings yayında", has(pubs, "tablename", "settings")],
    ["Politika: anon insert orders", policies.some((p) => p.policyname === "anon insert orders")],
    ["Politika: settings anon read", policies.some((p) => p.policyname === "settings anon read")],
    ["Satır: settings singleton", singleton.length === 1],
  ];

  say("\n=== DOĞRULAMA ===");
  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [name, ok] of rows) say(`  ${name.padEnd(w)}  ${ok ? "OK" : "EKSİK"}`);
  if (singleton.length === 1) say(`\n  settings.singleton → ordering_open=${singleton[0].ordering_open}, tükendi=${singleton[0].sold_out_count} ürün`);
  say(`  kayıt sayısı → orders=${counts[0].orders}, settings=${counts[0].settings}`);
  say(`  politikalar → ${policies.map((p) => `${p.tablename}:${p.policyname}`).join(" · ")}`);

  await client.end();
  const missing = rows.filter(([, ok]) => !ok);
  if (missing.length) {
    say(`\n${missing.length} EKSİK var.`);
    process.exit(1);
  }
  say("\nHepsi OK.");
}

main().catch((e) => {
  say("Beklenmeyen hata:", scrub(e.stack ?? e.message));
  process.exit(5);
});
