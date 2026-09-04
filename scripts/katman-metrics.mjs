/**
 * Katman görsellerinin görünür (alfa) sınır kutusunu ölçer ve lib/katmanMetrics.json'a yazar.
 *
 * Neden: her görselin içindeki nesne farklı genişlikte (ekmek 821 px, köfte 876 px, sos 792 px…)
 * ve `object-fit: contain` yüksekliğe göre sığdırdığı için sahnede ölçüler tutmuyordu
 * (üst ekmek devasa, köfte küçük görünüyordu). Ölçülen genişlikleri ortak bir referansa
 * normalize edip sahnede katman başına ölçek uyguluyoruz.
 *
 * Çıktı (kaynak boyutuna göre 0..1):
 *   w, h  → içerik kutusunun genişliği/yüksekliği
 *   cx, cy→ içerik merkezinin konumu (yatay hizalama için)
 *
 * Çalıştırma: pnpm assets:katman-metrics
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "public/assets/katman/src");
const OUT = path.join(process.cwd(), "lib/katmanMetrics.json");
/** alfa bu eşiğin üstündeyse "görünür piksel" sayılır */
const ALPHA = 16;

const files = readdirSync(SRC).filter((f) => f.endsWith(".webp"));
const metrics = {};
for (const f of files.sort()) {
  const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const key = f.replace(/\.webp$/, "");
  metrics[key] = {
    w: +((maxX - minX + 1) / info.width).toFixed(4),
    h: +((maxY - minY + 1) / info.height).toFixed(4),
    cx: +(((minX + maxX) / 2) / info.width).toFixed(4),
    cy: +(((minY + maxY) / 2) / info.height).toFixed(4),
  };
  console.log(`${key.padEnd(24)} w=${metrics[key].w} h=${metrics[key].h} cx=${metrics[key].cx}`);
}
writeFileSync(OUT, JSON.stringify(metrics, null, 2) + "\n");
console.log(`\n${Object.keys(metrics).length} katman → lib/katmanMetrics.json`);
