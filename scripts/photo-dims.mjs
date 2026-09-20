// public/urun/{icecek,yan}/*.webp + ortak/ → lib/photoDims.json
// Amaç: next/image'a DOĞRU intrinsic oranı vermek. Elle yazılan tablo dosyalarla
// zamanla uyumsuzlaşır; bu script ölçüp üretir. Görsel değişirse tekrar koş.
import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIRS = ["icecek", "yan", "ortak"];
const out = {};
for (const d of DIRS) {
  let files = [];
  try { files = (await readdir(path.join("public/urun", d))).filter((f) => f.endsWith(".webp")); } catch { continue; }
  for (const f of files.sort()) {
    const m = await sharp(path.join("public/urun", d, f)).metadata();
    out[`/urun/${d}/${f}`] = { w: m.width, h: m.height };
  }
}
await writeFile("lib/photoDims.json", JSON.stringify(out, null, 2) + "\n");
console.log(`${Object.keys(out).length} görsel → lib/photoDims.json`);
for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(40)} ${v.w}×${v.h}`);
