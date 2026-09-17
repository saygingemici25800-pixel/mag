/**
 * Galeri karelerini SİYAH-BEYAZ'a çevirir — CSS filtresiyle değil, DOSYANIN KENDİSİNİ.
 *
 * Tonlama referansı: 01.webp ve 26.webp (arşivden zaten siyah-beyaz gelen iki kare;
 * ölçüm: ortalama parlaklık ~112-118, kontrast std ~56-58). Diğer 61 kare bu
 * görünüme yaklaşsın diye linear/gamma değerleri buna göre seçildi.
 *
 * ZATEN SİYAH-BEYAZ OLANLAR ATLANIR: 01 ve 26'ya kontrast ikinci kez uygulanırsa
 * diğerlerinden daha sert çıkar, set içinde göze batar. Atlama sabit listeyle
 * değil ÖLÇÜMLE yapılır (doygunluk < 0.01) — böylece script tekrar tekrar
 * çalıştırılsa da hiçbir kare iki kez işlenmez (idempotent).
 *
 * Boyut ve dosya adı DEĞİŞMEZ; üzerine yazılır. Önce yedek alın:
 *   cp public/galeri/*.webp docs/backup/galeri-renkli/
 *
 * Kullanım: node scripts/galeri-bw.mjs [--dry]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = "public/galeri";
const DRY = process.argv.includes("--dry");
/** Bu eşiğin altındaki kare zaten gri kabul edilir ve İŞLENMEZ. */
const GRI_ESIK = 0.01;

/** Ortalama doygunluk (0 = tam gri). Küçük örnekleme yeter, karar için hassas. */
async function doygunluk(buf) {
  const { data, info } = await sharp(buf).resize(64, 64, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  let top = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    top += mx === 0 ? 0 : (mx - mn) / mx;
    n++;
  }
  return top / n;
}

const files = (await readdir(DIR)).filter((f) => f.endsWith(".webp")).sort();
let islenen = 0, atlanan = 0;

for (const f of files) {
  const p = path.join(DIR, f);
  const girdi = await readFile(p);
  const sat = await doygunluk(girdi);

  if (sat < GRI_ESIK) {
    console.log(`  ATLANDI  ${f}  (zaten gri, doygunluk ${sat.toFixed(4)})`);
    atlanan++;
    continue;
  }

  const meta = await sharp(girdi).metadata();
  const cikti = await sharp(girdi)
    .greyscale()
    .linear(1.18, -18) // kontrast artır, siyahları derinleştir
    .gamma(1.05)
    .sharpen({ sigma: 1.2 })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();

  if (!DRY) await writeFile(p, cikti);
  const yeni = await sharp(cikti).metadata();
  const uyar = yeni.width !== meta.width || yeni.height !== meta.height ? "  ⚠️ BOYUT DEĞİŞTİ" : "";
  console.log(
    `  çevrildi ${f}  ${meta.width}×${meta.height}  ${(girdi.length / 1024).toFixed(0)}K → ${(cikti.length / 1024).toFixed(0)}K${uyar}`,
  );
  islenen++;
}

console.log(`\nişlenen: ${islenen}  ·  atlanan (zaten gri): ${atlanan}  ·  toplam: ${files.length}${DRY ? "  [DRY — yazılmadı]" : ""}`);
