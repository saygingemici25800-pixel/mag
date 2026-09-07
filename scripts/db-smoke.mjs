/**
 * Uçtan uca duman testi — uygulamanın Supabase'e yazdığı/okuduğu yolun aynısını
 * gerçek veritabanına karşı çalıştırır (lib/supabase-store.ts sorgularının SQL karşılığı).
 *
 * Sipariş oluştur → mock ödeme onayı (paid) → panelin listesinde gör →
 * üç aşamayı ilerlet (kabul → kapanış) → ayar (tükendi) yaz/oku → test kaydını sil.
 *
 * GÜVENLİK: bağlantı dizesi hiçbir çıktıya yazılmaz.
 * Kullanım: node scripts/db-smoke.mjs [--keep]   (--keep: test siparişini silme)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const ROOT = process.cwd();
const KEEP = process.argv.includes("--keep");

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf8").catch(() => "");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
function scrub(s) {
  const url = process.env.DATABASE_URL ?? "";
  let out = String(s);
  if (url) {
    out = out.split(url).join("<DATABASE_URL>");
    try {
      const u = new URL(url);
      for (const x of [u.password, decodeURIComponent(u.password), u.username, u.hostname].filter(Boolean)) {
        if (x.length > 3) out = out.split(x).join("<gizli>");
      }
    } catch {}
  }
  return out.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "<DATABASE_URL>");
}
const say = (...a) => console.log(...a.map((x) => scrub(x)));

let fail = 0;
const check = (n, ok, extra = "") => {
  if (!ok) fail++;
  say(`${ok ? "PASS" : "FAIL"} ${n}${extra ? " — " + extra : ""}`);
};

await loadEnv();
const u = new URL(process.env.DATABASE_URL);
const client = new pg.Client({
  host: u.hostname,
  port: Number(u.port || 5432),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, "") || "postgres",
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30_000,
});
await client.connect();

const id = randomUUID();
const ref = "smoke-" + id.slice(0, 8);
try {
  /* 1) SİPARİŞ OLUŞTUR — /api/orders'ın yazdığı satırın aynısı (awaiting_payment ile açılır) */
  const items = [
    { id: "smooky", name: "Smooky", price: 620, qty: 1 },
    { id: "ayran", name: "Arslan ayran", price: 90, qty: 1 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const ins = await client.query(
    `insert into public.orders
       (id, type, zone, items, subtotal, fee, total, name, phone, address, requested_at, note,
        payment, payment_status, payment_ref, locale, status)
     values ($1,'delivery','merkez',$2::jsonb,$3,0,$3,'Duman Testi','05321234567','Test Sk. No:1','simdi',null,
             'online','awaiting_payment',$4,'tr','received')
     returning id, status, payment_status, total, created_at`,
    [id, JSON.stringify(items), subtotal, ref],
  );
  check("sipariş Supabase'e yazıldı", ins.rowCount === 1 && ins.rows[0].id === id, `#${id.slice(0, 8)} · ₺${ins.rows[0].total} · ${ins.rows[0].payment_status}`);

  /* 2) MOCK ÖDEME ONAYI — /api/payments/callback'in yaptığı güncelleme */
  const paid = await client.query(`update public.orders set payment_status='paid' where id=$1 and payment_ref=$2 returning payment_status`, [id, ref]);
  check("mock ödeme onayı (paid)", paid.rows[0]?.payment_status === "paid");

  /* 3) PANEL LİSTESİ — SupabaseOrderStore.list(): created_at desc, limit */
  const list = await client.query(`select id, name, total, status, payment_status from public.orders order by created_at desc limit 300`);
  const seen = list.rows.find((r) => r.id === id);
  check("panel listesinde görünüyor", Boolean(seen), seen ? `${seen.name} · ${seen.status}` : "bulunamadı");
  check("panel yalnızca ödenmişi işler (payment_status=paid)", seen?.payment_status === "paid");

  /* 4) ÜÇ AŞAMA — panelin PATCH ettiği alanlar */
  const acc = await client.query(
    `update public.orders set status='on_the_way', accepted_at=now(), prep_minutes=35 where id=$1
     returning status, prep_minutes, accepted_at`,
    [id],
  );
  check("YENİ → HAZIR (kurye: on_the_way, 35 dk)", acc.rows[0]?.status === "on_the_way" && acc.rows[0]?.prep_minutes === 35);
  const closed = await client.query(`update public.orders set status='delivered', closed_at=now() where id=$1 returning status, closed_at`, [id]);
  check("HAZIR → KAPANDI (delivered)", closed.rows[0]?.status === "delivered" && Boolean(closed.rows[0]?.closed_at));

  /* 5) AYARLAR — SupabaseSettingsStore.get()/patch() */
  const s0 = await client.query(`select ordering_open, sold_out from public.settings where id='singleton'`);
  check("ayarlar okunuyor", s0.rowCount === 1, `ordering_open=${s0.rows[0].ordering_open}`);
  await client.query(`update public.settings set sold_out='["ayran"]'::jsonb, updated_at=now() where id='singleton'`);
  const s1 = await client.query(`select sold_out from public.settings where id='singleton'`);
  check("tükendi işareti yazıldı/okundu", JSON.stringify(s1.rows[0].sold_out) === '["ayran"]', JSON.stringify(s1.rows[0].sold_out));
  await client.query(`update public.settings set sold_out='[]'::jsonb where id='singleton'`); // geri al
  check("tükendi işareti geri alındı", true);

  /* 6) REALTIME — panelin canlı akışı bu yayına bağlı */
  const rt = await client.query(`select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'`);
  const names = rt.rows.map((r) => r.tablename);
  check("realtime: orders + settings yayında", names.includes("orders") && names.includes("settings"), names.join(", "));

  /* 7) RLS — anon sipariş EKLEYEBİLİR ama OKUYAMAZ */
  await client.query("begin");
  await client.query("set local role anon");
  let anonRead = -1;
  try {
    anonRead = (await client.query(`select count(*)::int c from public.orders`)).rows[0].c;
  } catch {
    anonRead = -1;
  }
  let anonSettings = -1;
  try {
    anonSettings = (await client.query(`select count(*)::int c from public.settings`)).rows[0].c;
  } catch {
    anonSettings = -1;
  }
  await client.query("rollback");
  check("RLS: anon siparişleri okuyamıyor", anonRead === 0, `okunan satır=${anonRead}`);
  check("RLS: anon ayarları okuyabiliyor (kapalı/tükendi)", anonSettings === 1, `okunan satır=${anonSettings}`);
} finally {
  if (!KEEP) {
    await client.query(`delete from public.orders where id=$1`, [id]).catch(() => {});
    const left = await client.query(`select count(*)::int c from public.orders where payment_ref like 'smoke-%'`);
    say(`\ntest kaydı silindi · kalan duman kaydı: ${left.rows[0].c}`);
  }
  const total = await client.query(`select count(*)::int c from public.orders`);
  say(`orders tablosundaki toplam kayıt: ${total.rows[0].c}`);
  await client.end();
}

say(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
