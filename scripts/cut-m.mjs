// public/urun/*.webp → public/urun/mobil/<aynı-ad>.webp (300px yükseklik, kalite 72) — <900px'te kullanılır.
import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/urun";
const OUT = "public/urun/mobil";
const HEIGHT = 300;
const QUALITY = 72;

await mkdir(OUT, { recursive: true });
for (const f of (await readdir(SRC)).filter((n) => n.endsWith(".webp"))) {
  const out = path.join(OUT, f);
  const info = await sharp(path.join(SRC, f))
    .resize({ height: HEIGHT, withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 90 })
    .toFile(out);
  console.log(`${f} → ${out} ${info.width}×${info.height} ${(info.size / 1024).toFixed(1)} KB`);
}
