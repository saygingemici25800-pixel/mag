// Her cutout'un görsel ölçülerini hesaplayıp lib/cutCenters.json'a yazar:
//   cx, cy  → alfa ağırlıklı ağırlık merkezi (Stage x'i buna göre düzeltir; Smooky'nin füme
//             şeridi gibi tek yana taşan parçalarda görsel merkez kutunun merkezi değildir)
//   box     → görünen piksellerin sınır kutusu (saydam kenarlar hariç), görsel oranı 0..1
//   body    → "gövde" kutusu: dikeyde en az %50 dolu sütunlar, yatayda en az %50 dolu satırlar.
//             Bacon gibi ince çıkıntıları dışarıda bırakır; patlamış burger yığını bu gövdeye
//             oturtulur (tam görüntüden ölçülür, tahmin edilmez).
// Kullanım: pnpm assets:centers
import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "public/assets/cut";
const OUT = "lib/cutCenters.json";
const ALPHA = 16;
const COVER = 0.5;

const centers = {};
for (const f of (await readdir(SRC)).filter((n) => n.endsWith(".webp")).sort()) {
  const id = path.basename(f, ".webp");
  const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let sum = 0, sx = 0, sy = 0;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  const colFill = new Uint32Array(W), rowFill = new Uint32Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a < 8) continue;
      sum += a; sx += a * x; sy += a * y;
      if (a > ALPHA) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        colFill[x]++; rowFill[y]++;
      }
    }
  }
  const boxH = y1 - y0 + 1, boxW = x1 - x0 + 1;
  /* gövde: sınır kutusu içinde yeterince dolu sütun/satırlar */
  let bx0 = x0, bx1 = x1, by0 = y0, by1 = y1;
  while (bx0 < x1 && colFill[bx0] < boxH * COVER) bx0++;
  while (bx1 > x0 && colFill[bx1] < boxH * COVER) bx1--;
  while (by0 < y1 && rowFill[by0] < boxW * COVER) by0++;
  while (by1 > y0 && rowFill[by1] < boxW * COVER) by1--;
  const frac = (x, y, x2, y2) => ({
    x0: +(x / W).toFixed(4), x1: +((x2 + 1) / W).toFixed(4), y0: +(y / H).toFixed(4), y1: +((y2 + 1) / H).toFixed(4),
  });
  centers[id] = {
    cx: +(sum ? sx / sum / W : 0.5).toFixed(4),
    cy: +(sum ? sy / sum / H : 0.5).toFixed(4),
    box: frac(x0, y0, x1, y1),
    body: frac(bx0, by0, bx1, by1),
  };
  const b = centers[id].body;
  console.log(`${id.padEnd(9)} cx=${centers[id].cx}  box ${boxW}x${boxH}  gövde x ${b.x0}–${b.x1} y ${b.y0}–${b.y1}  (gövde en/boy ${(((bx1 - bx0) / (by1 - by0)) * (W / H)).toFixed(2)})`);
}
await writeFile(OUT, JSON.stringify(centers, null, 2) + "\n");
console.log(`→ ${OUT}`);
