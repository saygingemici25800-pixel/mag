// public/assets/og/<id>.png — OG görseli için PNG cutout (Satori WebP okumaz). 480px yükseklik.
import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
const SRC = "public/assets/cut", OUT = "assets/og"; // public dışı: yalnızca /api/og fs ile okur
await mkdir(OUT, { recursive: true });
for (const f of (await readdir(SRC)).filter((n) => n.endsWith(".webp"))) {
  const out = path.join(OUT, f.replace(".webp", ".png"));
  const info = await sharp(path.join(SRC, f)).resize({ height: 480, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toFile(out);
  console.log(`${f} → ${out} ${(info.size / 1024).toFixed(0)} KB`);
}
