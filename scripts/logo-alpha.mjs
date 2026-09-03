// public/brand/mag-safe_1.jpg (siyah zemin) → public/brand/mag-safe.png (şeffaf).
// Siyah pikseller alfa 0; kenarlarda yumuşak geçiş. Yeni logo gelirse: pnpm assets:logo
import sharp from "sharp";
import { statSync } from "node:fs";

const SRC = "public/brand/mag-safe_1.jpg";
const OUT = "public/brand/mag-safe.png";

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < info.width * info.height; i++) {
  const o = i * 4;
  const lum = Math.max(data[o], data[o + 1], data[o + 2]);
  data[o + 3] = lum <= 28 ? 0 : lum >= 64 ? 255 : Math.round(((lum - 28) / 36) * 255);
}
// Ekranda en fazla 560 CSS px → 2× için 1120 px yeter (2187 px gereksiz ağır)
const base = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).resize({ width: 1120 });
await base.clone().png({ compressionLevel: 9, quality: 90 }).toFile(OUT);
await base.clone().webp({ quality: 88, alphaQuality: 90 }).toFile(OUT.replace(".png", ".webp"));
for (const f of [OUT, OUT.replace(".png", ".webp")]) {
  const m = await sharp(f).metadata();
  console.log(`${f} ${m.width}×${m.height} alpha=${m.hasAlpha} ${(statSync(f).size / 1024).toFixed(0)} KB`);
}
