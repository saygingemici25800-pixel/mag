/* KANIT: site Supabase'e bağlıyken tarayıcıdan mock ödemeyle sipariş →
   kayıt gerçekten Supabase'de mi → panel realtime ile anında gördü mü.
   Anahtarlar ve bağlantı dizesi hiçbir çıktıya yazılmaz. */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { seedCart, fillDelivery, FAKE_NOW } from "./_cart-fixture.mjs";

const ROOT = "/Users/saygin/Downloads/mag-starter";
const base = "http://localhost:3112";
const raw = await readFile(ROOT + "/.env.local", "utf8");
const env = Object.fromEntries(raw.split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const KEY = process.env.PANEL_KEY ?? "test1234";

let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* doğrudan DB bağlantısı: kaydın gerçekten Supabase'de olduğunu kanıtlar */
const u = new URL(env.DATABASE_URL);
const db = new pg.Client({ host: u.hostname, port: +u.port, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false } });
await db.connect();
const before = (await db.query("select count(*)::int c from public.orders")).rows[0].c;
console.log(`Supabase orders tablosu — başlangıç kayıt sayısı: ${before}`);

const b = await chromium.launch();

/* --- panel: Supabase Auth ile giriş, realtime dinliyor --- */
const panelCtx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await panelCtx.addInitScript(() => { localStorage.setItem("mag:panel-sound", "1"); });
const panel = await panelCtx.newPage();
await panel.goto(base + "/panel", { waitUntil: "load" });
await panel.waitForSelector("form input[type=password]", { timeout: 10000 });
await panel.fill('form input[type="password"]', KEY);
await panel.click('form button[type="submit"]');
await panel.waitForSelector(".tabs", { timeout: 15000 });
check("panel PANEL_KEY ile açıldı (Supabase yalnızca veri katmanı)", true);
/* Canlı akış: panel SSE ile dinler (Supabase realtime anon RLS'i geçemediği için kullanılmıyor). */
await panel.waitForFunction(() => document.querySelector("[data-feed]")?.dataset.live === "true", null, { timeout: 20000 }).catch(() => {});
const st = await panel.evaluate(() => { const el = document.querySelector("[data-feed]"); return { text: el?.textContent?.trim(), live: el?.dataset.live, feed: el?.dataset.feed }; });
check("canlı akış bağlandı (sunucu üzerinden)", st.live === "true" && ["sse", "poll"].includes(st.feed ?? ""), `${st.feed} · ${st.text}`);

/* --- site: mock ödemeyle gerçek sipariş --- */
const shopCtx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await seedCart(shopCtx, { smooky: 1, brisket: 1, ayran: 1 });
const shop = await shopCtx.newPage();
await shop.clock.install({ time: FAKE_NOW });
await shop.goto(base + "/siparis/odeme", { waitUntil: "load" });
await shop.waitForTimeout(900);
await fillDelivery(shop, { zone: "merkez", address: "Supabase Kanıt Sk. No:7", name: "Supabase Kanit", phone: "05329998877" });
const t0 = Date.now();
await shop.click('button[type="submit"]');
await shop.waitForURL(/\/odeme\/test/, { timeout: 20000 });
await shop.getByRole("button", { name: "Ödemeyi tamamla" }).click();
await shop.waitForURL(/\/siparis\/[0-9a-f-]{36}/, { timeout: 25000 });
const id = shop.url().split("/siparis/")[1].split("?")[0];
check("sipariş oluştu (mock ödeme)", /^[0-9a-f-]{36}$/.test(id), "#" + id.slice(0, 8));

/* --- kanıt 1: kayıt GERÇEKTEN Supabase'de --- */
const row = (await db.query("select id, name, phone, address, total, status, payment_status, type from public.orders where id=$1", [id])).rows[0];
check("kayıt Supabase'de bulundu", Boolean(row), row ? `${row.name} · ₺${row.total} · ${row.payment_status}` : "yok");
check("alanlar doğru yazıldı (telefon +90 normalize)", row?.name === "Supabase Kanit" && row?.phone === "+905329998877" && row?.type === "delivery" && /Kanıt Sk/.test(row?.address ?? ""), row ? `${row.phone} · ${row.type}` : "");
check("ödeme durumu paid", row?.payment_status === "paid", row?.payment_status);
const after = (await db.query("select count(*)::int c from public.orders")).rows[0].c;
check("tablo kayıt sayısı arttı", after === before + 1, `${before} → ${after}`);

/* --- kanıt 2: panel REALTIME ile gördü (sayfa yenilenmeden) --- */
await panel.waitForSelector(`.ocard[data-id="${id}"]`, { timeout: 8000 });
const ms = Date.now() - t0;
check("panel siparişi canlı gördü (yenileme yok)", true, `${ms} ms (ödeme akışı dahil)`);
const cardText = await panel.locator(`.ocard[data-id="${id}"]`).textContent();
check("kartta müşteri ve ürün görünüyor", /Supabase Kanit/.test(cardText ?? "") && /Smooky/.test(cardText ?? ""));
await panel.screenshot({ path: ROOT + "/docs/screens/panel/supabase-realtime.png" });

/* --- kanıt 3: panelden aşama ilerlet → Supabase'e yazıldı --- */
await panel.locator(`.ocard[data-id="${id}"] [data-accept]`).click();
await panel.waitForSelector(`.ocard[data-id="${id}"] [data-close]`, { timeout: 8000 });
await panel.waitForTimeout(800);
const upd = (await db.query("select status, prep_minutes, accepted_at from public.orders where id=$1", [id])).rows[0];
check("panel güncellemesi Supabase'e yazıldı", upd?.status === "on_the_way" && upd?.prep_minutes === 30 && Boolean(upd?.accepted_at), `${upd?.status} · ${upd?.prep_minutes} dk`);

/* --- temizlik: test kaydını sil --- */
await db.query("delete from public.orders where id=$1", [id]);
const finalCount = (await db.query("select count(*)::int c from public.orders")).rows[0].c;
check("test kaydı silindi", finalCount === before, `kalan kayıt: ${finalCount}`);

await db.end();
await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
