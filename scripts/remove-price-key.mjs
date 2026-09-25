/**
 * Fiyat haritasından TEK bir anahtarı kaldırır.
 *
 * Neden ayrı script: `prices` PATCH'i artık BİRLEŞTİRİYOR (24 Eyl 2026 koruması).
 * Birleştirmede "gönderilmeyen anahtar" = "dokunma" demek, dolayısıyla bir
 * anahtarı SİLMEK için `replace: true` ile TAM listeyi yazmak gerekiyor.
 * Elle yapılırsa tüm haritayı uçurma riski var — bu yüzden okuma/çıkarma/yazma
 * tek yerde ve doğrulamalı.
 *
 * Kullanım:
 *   node scripts/remove-price-key.mjs <anahtar> <taban>            # RAPOR (yazmaz)
 *   node scripts/remove-price-key.mjs <anahtar> <taban> --apply    # yedekle + yaz
 *
 * Örn: node scripts/remove-price-key.mjs citir https://magstreetfood.com --apply
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const [anahtar, taban] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
if (!anahtar || !taban) {
  console.error("kullanım: node scripts/remove-price-key.mjs <anahtar> <taban> [--apply]");
  process.exit(1);
}

/* PANEL_KEY tabana göre seçilir. YEREL koşuda .env.local'daki CANLI anahtar
   kullanılırsa test sunucusu 401 veriyor — anahtarı önce tabana bakarak seç. */
const yerelMi = /localhost|127\.0\.0\.1/.test(taban);
let KEY = process.env.PANEL_KEY || "";
if (yerelMi) {
  KEY = process.env.PANEL_KEY || "test1234";
} else if (!KEY) {
  try {
    for (const l of readFileSync(".env.local", "utf8").split("\n")) {
      const t = l.trim();
      if (t.startsWith("PANEL_KEY=")) KEY = t.slice("PANEL_KEY=".length).trim();
    }
  } catch { /* .env.local olmayabilir */ }
}
if (!KEY) { console.error("PANEL_KEY bulunamadı."); process.exit(1); }

const U = taban.replace(/\/$/, "") + "/api/panel/settings";
const H = { "content-type": "application/json", "x-panel-key": KEY };

const once = await (await fetch(U, { cache: "no-store" })).json();
const onceki = once.prices ?? {};
const N = Object.keys(onceki).length;
console.log(`taban: ${taban}`);
console.log(`ÖNCE: ${N} kayıt`);

if (!(anahtar in onceki)) {
  console.log(`"${anahtar}" haritada YOK — yapılacak bir şey yok.`);
  process.exit(0);
}
console.log(`silinecek: ${anahtar} = ${onceki[anahtar]}`);

const yeni = { ...onceki };
delete yeni[anahtar];
console.log(`SONRA (beklenen): ${Object.keys(yeni).length} kayıt`);

if (!APPLY) {
  console.log("\n(rapor modu — hiçbir şey yazılmadı. Yazmak için: --apply)");
  process.exit(0);
}

/* YEDEK — yazmadan ÖNCE, her zaman. */
mkdirSync("docs/backup", { recursive: true });
const damga = new Date().toISOString().replace(/[:.]/g, "-");
const dosya = `docs/backup/prices-${new URL(taban).hostname}-${damga}.json`;
writeFileSync(dosya, JSON.stringify({ alindi: new Date().toISOString(), taban, prices: onceki }, null, 2));
console.log(`yedek: ${dosya} (${N} kayıt)`);

/* replace: TAM listeyi yaz — anahtarın yokluğu ancak böyle "sil" demek.
   allow_empty: harita tek anahtarlıysa boşalabilir; niyet açık. */
const r = await fetch(U, { method: "PATCH", headers: H, body: JSON.stringify({ prices: yeni, replace: true, allow_empty: true }) });
if (!r.ok) { console.error("YAZILAMADI", r.status, (await r.text()).slice(0, 200)); process.exit(1); }
const sonra = (await r.json()).prices ?? {};

/* DOĞRULA: sayı N-1 mi, silinen gitti mi, DİĞERLERİ birebir aynı mı. */
const sayiOk = Object.keys(sonra).length === N - 1;
const gitti = !(anahtar in sonra);
const bozulan = Object.entries(onceki).filter(([k, v]) => k !== anahtar && sonra[k] !== v);
console.log(`\nSONRA: ${Object.keys(sonra).length} kayıt  ${sayiOk ? "✓" : "✗ beklenen " + (N - 1)}`);
console.log(`"${anahtar}" silindi: ${gitti ? "✓" : "✗"}`);
console.log(bozulan.length ? `✗ DEĞİŞEN DİĞER KAYIT: ${bozulan.map(([k]) => k).join(", ")}` : `✓ diğer ${N - 1} kaydın hepsi birebir aynı`);
process.exit(sayiOk && gitti && !bozulan.length ? 0 : 1);
