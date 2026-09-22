// public/urun/{icecek,yan,sos}/*.webp + ortak/ → lib/photoDims.json
// Amaç: next/image'a DOĞRU intrinsic oranı vermek. Elle yazılan tablo dosyalarla
// zamanla uyumsuzlaşır; bu script ölçüp üretir. Görsel değişirse tekrar koş.
import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

/* "" = public/urun kökü: hero kesimleri orada (ör. citir.webp — 21 Eyl 2026'da
   burgerden yan ürünlere taşındı ve artık `photo` ile gösteriliyor). */
const DIRS = ["", "icecek", "yan", "sos", "ortak"];
const out = {};
for (const d of DIRS) {
  let files = [];
  const dizin = d ? path.join("public/urun", d) : "public/urun";
  try { files = (await readdir(dizin, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".webp")).map((e) => e.name); } catch { continue; }
  for (const f of files.sort()) {
    const m = await sharp(path.join(dizin, f)).metadata();
    out[d ? `/urun/${d}/${f}` : `/urun/${f}`] = { w: m.width, h: m.height };
  }
}
await writeFile("lib/photoDims.json", JSON.stringify(out, null, 2) + "\n");
console.log(`${Object.keys(out).length} görsel → lib/photoDims.json`);
for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(40)} ${v.w}×${v.h}`);
