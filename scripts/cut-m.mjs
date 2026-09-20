// public/urun/*.webp → public/urun/mobil/<aynı-ad>.webp (300px yükseklik, kalite 72) — <900px'te kullanılır.
//
// 20 Eyl 2026: içecek ve yan ürün görselleri alt klasöre geldi
// (public/urun/icecek/, public/urun/yan/). Mobil kopyaları da aynı alt klasör
// yapısını koruyor: public/urun/mobil/icecek/…, /mobil/yan/… — böylece ad
// çakışması olmuyor (ör. yan/noodle.webp ile kökteki bir noodle.webp).
import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/urun";
const OUT = "public/urun/mobil";
const HEIGHT = 300;
const QUALITY = 72;
/** Kaynak alt klasörler — mobil kopyaları aynı adla ayna klasöre yazılır. */
const ALT = ["icecek", "yan"];

async function isle(srcDir, outDir) {
  await mkdir(outDir, { recursive: true });
  for (const f of (await readdir(srcDir)).filter((n) => n.endsWith(".webp"))) {
    const out = path.join(outDir, f);
    const info = await sharp(path.join(srcDir, f))
      .resize({ height: HEIGHT, withoutEnlargement: true })
      .webp({ quality: QUALITY, alphaQuality: 90 })
      .toFile(out);
    console.log(`${path.relative(SRC, path.join(srcDir, f))} → ${out} ${info.width}×${info.height} ${(info.size / 1024).toFixed(1)} KB`);
  }
}

await isle(SRC, OUT);
for (const k of ALT) await isle(path.join(SRC, k), path.join(OUT, k));
