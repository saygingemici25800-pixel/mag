// Her cutout'un görsel ağırlık merkezini (alfa ağırlıklı centroid) hesaplayıp lib/cutCenters.json'a yazar.
// Smooky'nin füme şeridi gibi tek yana taşan parçalarda görsel merkez kutunun merkezi değildir;
// Stage bu değerle x'i düzeltir → her burger görsel ağırlığıyla ortalanır.
// Kullanım: pnpm assets:centers
import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "public/assets/cut";
const OUT = "lib/cutCenters.json";

const centers = {};
for (const f of (await readdir(SRC)).filter((n) => n.endsWith(".webp")).sort()) {
  const id = path.basename(f, ".webp");
  const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let sum = 0,
    sx = 0,
    sy = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a < 8) continue;
      sum += a;
      sx += a * x;
      sy += a * y;
    }
  }
  const cx = sum ? sx / sum / W : 0.5;
  const cy = sum ? sy / sum / H : 0.5;
  centers[id] = { cx: +cx.toFixed(4), cy: +cy.toFixed(4) };
  console.log(`${id}  cx=${cx.toFixed(3)}  cy=${cy.toFixed(3)}  (sapma ${((cx - 0.5) * 100).toFixed(1)}%)`);
}
await writeFile(OUT, JSON.stringify(centers, null, 2) + "\n");
console.log(`→ ${OUT}`);
