// Ham katman görsellerini public/assets/katman/ altına WebP olarak yazar.
// Kullanım: node scripts/katman-import.mjs <kaynak> <hedefAd>    (ör. smooky-1-et)
//
// Görseller siyah zeminli geliyor (şeffaf değil). Sahne zemini de --char (#0C0A08) olduğu için
// slotta `mix-blend-mode: screen` kullanılıyor: siyah piksel = nötr, yani zemin görünmez.
// Şeffaf PNG gelirse bu script yine çalışır (alfa korunur).
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

const [src, name] = process.argv.slice(2);
if (!src || !name) {
  console.error("kullanım: node scripts/katman-import.mjs <kaynak> <ad>");
  process.exit(1);
}
const OUT_DIR = "public/assets/katman";
mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, `${name}.webp`);

// Kenarlardaki tamamen siyah boşluğu kırp, 560 px'e küçült (slot en fazla 220 CSS px → 2× yeter)
await sharp(src)
  .trim({ threshold: 12 })
  .resize({ height: 560, withoutEnlargement: true })
  .webp({ quality: 86 })
  .toFile(out);
const m = await sharp(out).metadata();
console.log(`${out} ${m.width}×${m.height} ${(statSync(out).size / 1024).toFixed(0)} KB`);
