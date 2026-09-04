/**
 * Katman görsellerini ekranda kapladıkları boyutta üretir.
 *
 * Kaynaklar 1024 px kare; sahnede masaüstünde ~1010, mobilde ~525 CSS px genişlikte
 * çiziliyorlardı. Kompozitörün her karede büyük dokuyu küçültmesi pahalı olduğu için
 * iki boy üretiyoruz ve `srcset` ile tarayıcıya seçtiriyoruz:
 *
 *   <ad>.webp     → 1x  (mobil 1x / masaüstü 1x için yeterli genişlik)
 *   <ad>@2x.webp  → 2x  (mobil retina; masaüstü retina kaynağın izin verdiği kadar)
 *
 * Kaynaklar public/assets/katman/src/ altında durur; çıktı public/assets/katman/ içine yazılır.
 * Çalıştırma: pnpm assets:katman
 */
import { mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "public/assets/katman/src");
const OUT = path.join(process.cwd(), "public/assets/katman");

/** 1x genişlik: mobilde ~525, masaüstünde ~1010 CSS px çiziliyor → 2 boy yeter */
const W1 = 560;
const W2 = 1024; // kaynak sınırı; masaüstü 1x ve mobil 2x bunu kullanır
const QUALITY = 86;

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".webp"));
if (!files.length) {
  console.error("public/assets/katman/src altında .webp yok");
  process.exit(1);
}

let total = 0;
let before = 0;
for (const f of files) {
  const base = f.replace(/\.webp$/, "");
  before += statSync(path.join(SRC, f)).size;
  for (const [w, suffix] of [
    [W1, ""],
    [W2, "@2x"],
  ]) {
    const dst = path.join(OUT, `${base}${suffix}.webp`);
    await sharp(path.join(SRC, f))
      .resize({ width: w, height: w, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dst);
    total += statSync(dst).size;
  }
}
console.log(`${files.length} kaynak → ${files.length * 2} dosya (${W1}px + ${W2}px)`);
console.log(`kaynak ${(before / 1024) | 0} KB · çıktı ${(total / 1024) | 0} KB`);
