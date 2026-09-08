/**
 * Marka logosu türevleri — preloader için WebP setleri (srcset).
 *
 * Kaynak: public/brand/mag-logo-cream.png (912×434, saydam).
 * Üretilen: tek dosya — mag-logo-cream.webp (912 px, KAYIPSIZ).
 *
 * Neden tek dosya ve neden lossless: logo düz renk + alfadan ibaret, bu yüzden 912 px kayıpsız WebP
 * yalnızca ~9 KB — küçültülmüş kayıplı türevlerden (300px: 11 KB, 460px: 18 KB) DAHA HAFİF.
 * srcset'e gerek yok: tek dosya her DPI'da en keskin ve en küçük seçenek.
 *
 * Hedef CSS genişlikleri: masaüstü min(460px, 42vw) · mobil min(300px, 72vw).
 * 912 px kaynak mobilde 3x'i (900 px) karşılar, masaüstünde 2x'e 8 px eksik kalır (pratikte fark edilmez).
 *
 * Kullanım: node scripts/brand-derivatives.mjs
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "brand");
const SRC = "mag-logo-cream.png";
const OUT = "mag-logo-cream.webp";

const src = path.join(DIR, SRC);
const meta = await sharp(src).metadata();
console.log(`kaynak: ${SRC} ${meta.width}×${meta.height} (${((await stat(src)).size / 1024).toFixed(1)} KB)`);

const out = path.join(DIR, OUT);
await sharp(src).webp({ lossless: true, effort: 6 }).toFile(out);
const s = await stat(out);
const m = await sharp(out).metadata();
console.log(`üretilen: ${OUT} ${m.width}×${m.height} (${(s.size / 1024).toFixed(1)} KB, kayıpsız, alfa: ${m.hasAlpha})`);

const all = (await readdir(DIR)).filter((f) => f.startsWith("mag-logo"));
console.log(`brand/ içindeki mag-logo dosyaları: ${all.join(", ")}`);
