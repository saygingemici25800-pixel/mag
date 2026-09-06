/**
 * Hero kesimlerini yatayda ortalar (public/assets/cut + cut-m).
 *
 * NEDEN: `background-size: contain` / `object-fit: contain` TUVALİ ortalar, ürünü değil.
 * Kesimin bir yanında boş alan varsa (ör. smooky: 819 px tuval, ürün 655 px'te bitiyor →
 * sağda 164 px boşluk) ürün ekranda yana kaçar. Telafiyi kodda değil GÖRSELDE yapıyoruz.
 *
 * NE YAPAR: her dosyanın alfa kanalından ürünün gerçek sınır kutusunu bulur, tuval merkezi ile
 * ürün merkezi arasındaki farkı ölçer. Fark 4 px'ten büyükse görseli yatayda yeniden kırpar:
 * ürünün sınır kutusunun iki yanında 4 px pay kalır, kutu tuvalde ortalanır. Yükseklik değişmez.
 *
 * Kullanım:  node scripts/center-cuts.mjs [--dry]
 *   --dry  yalnızca ölçüm yazar, dosyayı değiştirmez
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DIRS = ["public/assets/cut", "public/assets/cut-m"];
/** Sınır kutusunun iki yanında bırakılan pay */
const PAD = 4;
/** Bu eşiğin altındaki kaçıklık dokunulmadan bırakılır */
const TOLERANCE = 4;
/** Alfa bu değerin altındaysa piksel "boş" sayılır (kesim kenarlarındaki yumuşak geçiş) */
const ALPHA_MIN = 8;
/** WebP kalitesi — mevcut dosyalarla aynı seviyede kalsın (cut-m.mjs 72 kullanıyor) */
const QUALITY = { "public/assets/cut": 92, "public/assets/cut-m": 72 };

const dry = process.argv.includes("--dry");

/** Alfa kanalından ürünün yatay sınırları (ilk ve son dolu sütun) */
async function bounds(file) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * ch + ch - 1] >= ALPHA_MIN) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { width, height, x0, x1, y0, y1 };
}

const rows = [];
for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  let files = [];
  try {
    files = (await readdir(abs)).filter((f) => f.endsWith(".webp")).sort();
  } catch {
    continue;
  }
  for (const f of files) {
    const file = path.join(abs, f);
    const b = await bounds(file);
    if (b.x1 < 0) {
      rows.push({ dir, f, note: "tamamen saydam — atlandı" });
      continue;
    }
    const canvasCx = b.width / 2;
    const productCx = (b.x0 + b.x1 + 1) / 2;
    const offset = productCx - canvasCx; // + ise ürün sağda
    const row = { dir, f, w: b.width, h: b.height, x0: b.x0, x1: b.x1, offset: +offset.toFixed(1), left: b.x0, right: b.width - 1 - b.x1 };

    if (Math.abs(offset) <= TOLERANCE) {
      row.action = "dokunulmadı";
      rows.push(row);
      continue;
    }
    /* Yeni tuval: ürünün sınır kutusu + iki yanda PAD. Kaynaktan kırpılacak bölge kutuyu
       içeriyorsa doğrudan extract; taşıyorsa (pay kadar yer yoksa) eksik kısmı saydamla doldur. */
    const boxW = b.x1 - b.x0 + 1;
    const newW = boxW + PAD * 2;
    const srcLeft = b.x0 - PAD;
    const pipeline = sharp(file).ensureAlpha().extend({
      left: Math.max(0, -srcLeft),
      right: Math.max(0, srcLeft + newW - b.width),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const buf = await pipeline
      .extract({ left: Math.max(0, srcLeft), top: 0, width: newW, height: b.height })
      .webp({ quality: QUALITY[dir] ?? 92, effort: 6, alphaQuality: 100 })
      .toBuffer();
    row.newW = newW;
    row.action = dry ? `kırpılacak (${b.width} → ${newW})` : `kırpıldı (${b.width} → ${newW})`;
    if (!dry) await writeFile(file, buf);
    rows.push(row);
  }
}

const before = await Promise.all(
  rows.filter((r) => r.newW).map(async (r) => {
    const b = await bounds(path.join(ROOT, r.dir, r.f));
    return [r.dir + "/" + r.f, +(((b.x0 + b.x1 + 1) / 2 - b.width / 2)).toFixed(1)];
  }),
);
const after = Object.fromEntries(before);

console.log("dizin/dosya".padEnd(34), "tuval".padEnd(10), "ürün kutusu".padEnd(14), "sol/sağ boşluk".padEnd(16), "kaçıklık".padEnd(10), "sonuç");
for (const r of rows) {
  if (r.note) {
    console.log(`${(r.dir + "/" + r.f).padEnd(34)} ${r.note}`);
    continue;
  }
  const key = r.dir + "/" + r.f;
  const post = after[key] !== undefined ? ` → ${after[key]} px` : "";
  console.log(
    `${key.padEnd(34)} ${`${r.w}×${r.h}`.padEnd(10)} ${`${r.x0}–${r.x1}`.padEnd(14)} ${`${r.left} / ${r.right}`.padEnd(16)} ${`${r.offset > 0 ? "+" : ""}${r.offset} px`.padEnd(10)} ${r.action}${post}`,
  );
}
const touched = rows.filter((r) => r.newW).length;
console.log(`\n${rows.length} dosya tarandı · ${touched} dosya ${dry ? "kırpılacak" : "yeniden yazıldı"} · eşik ${TOLERANCE} px · pay ${PAD} px`);
