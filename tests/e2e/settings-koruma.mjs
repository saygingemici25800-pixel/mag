/**
 * PATCH /api/panel/settings — VERİ KAYBI KORUMASI (24 Eyl 2026).
 *
 * Olay: `prices` gönderildiğinde mevcut harita tamamen değişiyordu. Yalnız 5 sos
 * yazılınca canlıdaki 33 kayıt 5'e düştü; ürünler kod varsayılanına düştüğü için
 * bir süre yanlış fiyattan göründü. Bu paket o davranışın geri gelmemesini bekler.
 *
 * YEREL sunucuda koşar, canlıya DOKUNMAZ.
 * Koşma: pnpm test:server çalışırken → node tests/e2e/settings-koruma.mjs
 */
import { PANEL_KEY as KEY, assertServerReady } from "./_cart-fixture.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
await assertServerReady(base);

let fail = 0;
const check = (n, ok, x = "") => {
  console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : ""));
  if (!ok) fail++;
};

const H = { "content-type": "application/json", "x-panel-key": KEY };
const oku = async () => (await fetch(base + "/api/panel/settings", { cache: "no-store" })).json();
const patch = async (body) => {
  const r = await fetch(base + "/api/panel/settings", { method: "PATCH", headers: H, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/* ---- HAZIRLIK: bilinen bir fiyat haritası kur (replace ile) ---- */
const BASLANGIC = {
  smooky: 680, brisket: 600, berry: 600, caesar: 540, orjinal: 570, jalapeno: 570,
  citir: 540, "citir-tavuk": 540, limonata: 140, kola: 120, "kola-zero": 120,
  "kola-light": 120, sprite: 120, fanta: 120, su: 60, soda: 80, ayran: 100,
  patates: 330, "patates-parmesan": 385, "tavuk-taco": 500, "tiftik-taco": 580,
  "karides-taco": 570, "tavuklu-noodle": 500, "karidesli-noodle": 600,
  "uludag-gazoz": 120, "uludag-portakalli": 120, "alkolsuz-bira": 200,
  "zencefilli-gazoz": 200, "mag-sos": 50, "sweet-chili": 50, "jalapeno-sos": 50,
  "truflu-mayonez": 50, "tutsu-biberli-aioli": 50,
};
{
  const r = await patch({ prices: BASLANGIC, replace: true });
  check("hazırlık: 33 kayıtlık harita kuruldu", r.status === 200 && Object.keys(r.body.prices ?? {}).length === 33, `${r.status} · ${Object.keys(r.body.prices ?? {}).length} kayıt`);
}

/* ---- 1) TEK ÜRÜN PATCH → diğer 32 kayıt yerinde kalmalı (asıl hata) ---- */
{
  const r = await patch({ prices: { smooky: 999 } });
  const p = r.body.prices ?? {};
  check("tek ürün PATCH kabul edildi", r.status === 200, String(r.status));
  check("→ güncellenen ürün yeni değerde", p.smooky === 999, "smooky=" + p.smooky);
  check("→ TOPLAM 33 kayıt duruyor (uçmadı)", Object.keys(p).length === 33, Object.keys(p).length + " kayıt");
  const bozulan = Object.entries(BASLANGIC).filter(([k, v]) => k !== "smooky" && p[k] !== v);
  check("→ diğer 32 kayıt AYNEN korundu", bozulan.length === 0, bozulan.length ? bozulan.map(([k]) => k).join(", ") : "hepsi yerinde");
  await patch({ prices: { smooky: 680 } }); // geri al
}

/* ---- 2) BOŞ prices haritası reddedilmeli ---- */
{
  const r = await patch({ prices: {} });
  check("boş prices haritası REDDEDİLDİ", r.status === 422 && r.body.error === "prices-empty", `${r.status} ${r.body.error ?? ""}`);
  const p = (await oku()).prices ?? {};
  check("→ harita bozulmadı (33 kayıt)", Object.keys(p).length === 33, Object.keys(p).length + " kayıt");
}
/* replace ile boş: yine reddedilmeli (allow_empty olmadan) */
{
  const r = await patch({ prices: {}, replace: true });
  check("replace:true + boş harita da REDDEDİLDİ", r.status === 422 && r.body.error === "prices-empty", `${r.status} ${r.body.error ?? ""}`);
}

/* ---- 3) BOŞ zones dizisi reddedilmeli ---- */
{
  const oncekiZ = (await oku()).zones ?? [];
  const r = await patch({ zones: [] });
  check("boş zones dizisi REDDEDİLDİ", r.status === 422 && r.body.error === "zones-empty", `${r.status} ${r.body.error ?? ""}`);
  const sonrakiZ = (await oku()).zones ?? [];
  check("→ mahalle listesi bozulmadı", sonrakiZ.length === oncekiZ.length && oncekiZ.length > 0, `${oncekiZ.length} → ${sonrakiZ.length}`);
}

/* ---- 4) PANEL AKIŞI BOZULMADI: tam+seyrek liste, replace ile fiyat SİLME ---- */
{
  /* Panel ekranı seyrek harita + replace:true + allow_empty:true gönderir.
     "limonata" haritadan çıkarılırsa ezmesi KALKMALI (panelin fiyat silme yolu). */
  const seyrek = { ...BASLANGIC };
  delete seyrek.limonata;
  const r = await patch({ prices: seyrek, replace: true, allow_empty: true });
  const p = r.body.prices ?? {};
  check("panel akışı (replace) kabul edildi", r.status === 200, String(r.status));
  check("→ haritadan çıkarılan ürünün ezmesi KALKTI", p.limonata === undefined, "limonata=" + p.limonata);
  check("→ kalan 32 kayıt yerinde", Object.keys(p).length === 32, Object.keys(p).length + " kayıt");
  /* geri koy */
  const geri = await patch({ prices: { limonata: 140 } });
  check("→ birleştirme ile geri eklendi", (geri.body.prices ?? {}).limonata === 140 && Object.keys(geri.body.prices ?? {}).length === 33, Object.keys(geri.body.prices ?? {}).length + " kayıt");
}

/* ---- 5) schedule: eksik gövde saatleri varsayılana düşürmemeli ---- */
{
  const r = await patch({ schedule: {} });
  check("eksik schedule REDDEDİLDİ", r.status === 422 && r.body.error === "schedule-invalid", `${r.status} ${r.body.error ?? ""}`);
}

/* ---- 6) sold_out: boş dizi SERBEST (panel son işareti böyle kaldırıyor) ---- */
{
  const r = await patch({ sold_out: [] });
  check("boş sold_out serbest (panel akışı)", r.status === 200 && Array.isArray(r.body.sold_out) && r.body.sold_out.length === 0, String(r.status));
}

console.log(fail ? `\n${fail} DÜŞEN` : "\nhepsi geçti");
process.exit(fail ? 1 : 0);
