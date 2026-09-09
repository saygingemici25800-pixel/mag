/**
 * Rusça (Kiril) yedek yazı tiplerini üretir.
 *
 * NEDEN GEREKLİ: Comico ve Bonny'de Kiril harf YOK — ölçüldü, her ikisinde de 0/66.
 * Onlarla Rusça metin kutu (tofu) çıkar. Bu betik Latin + Kiril alt kümelerini TEK dosyada
 * birleştirir; salt Kiril alt kümesinde rakam ve noktalama olmadığı için fiyatlar
 * ("1 310 ₺") bozulurdu.
 *
 * SEÇİMLER (docs: app/globals.css içindeki uzun not):
 *   Comico → Seymour One          (kalın, yuvarlak, elle çizilmiş büyük harf başlık)
 *   Bonny  → Fira Sans Condensed  (dar gövde; 400/500/700)
 * İkisi de OFL-1.1, fontsource üzerinden Google Fonts kaynağı.
 *
 * ₺ (U+20BA) bu dosyalarda YOK; CSS yığınında Comico/Bonny önce geldiği için simge
 * onlardan gelir. Kontrol edildi: fiyat satırında tofu çıkmıyor.
 *
 * Kullanım: node scripts/ru-fonts.mjs
 * Gereksinim: Python + fontTools (birleştirme için). Kurulu değilse betik nedenini yazıp çıkar.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "fonts");
const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";

/** [fontsource id, ağırlık, hedef dosya adı] */
const JOBS = [
  ["seymour-one", 400, "SeymourOneRU-400.woff2"],
  ["fira-sans-condensed", 400, "FiraSansCondensedRU-400.woff2"],
  ["fira-sans-condensed", 500, "FiraSansCondensedRU-500.woff2"],
  ["fira-sans-condensed", 700, "FiraSansCondensedRU-700.woff2"],
];

const MERGE_PY = `
import sys
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
lat, cyr, out = sys.argv[1], sys.argv[2], sys.argv[3]
tmp = []
for i, f in enumerate((lat, cyr)):
    ft = TTFont(f); ft.flavor = None
    p = f + f".{i}.ttf"; ft.save(p); tmp.append(p)
font = Merger().merge(tmp)
font.flavor = "woff2"
font.save(out)
ft = TTFont(out, lazy=True)
cps = set()
for t in ft["cmap"].tables: cps |= set(t.cmap.keys())
RU = [chr(c) for c in range(0x0410, 0x0450)] + ["Ё", "ё"]
print(f"{out}: Kiril {sum(1 for c in RU if ord(c) in cps)}/66, rakam {sum(1 for c in '0123456789' if ord(c) in cps)}/10")
`;

const dl = async (url, dest) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`indirilemedi (${r.status}): ${url}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
};

const tmp = mkdtempSync(path.join(tmpdir(), "rufonts-"));
const py = path.join(tmp, "merge.py");
writeFileSync(py, MERGE_PY);

for (const [id, weight, out] of JOBS) {
  const lat = path.join(tmp, `${id}-lat-${weight}.woff2`);
  const cyr = path.join(tmp, `${id}-cyr-${weight}.woff2`);
  await dl(`${CDN}/${id}@latest/latin-${weight}-normal.woff2`, lat);
  await dl(`${CDN}/${id}@latest/cyrillic-${weight}-normal.woff2`, cyr);
  const target = path.join(OUT, out);
  try {
    const log = execFileSync("python3", [py, lat, cyr, target], { encoding: "utf8" });
    console.log(`${log.trim()}  (${(statSync(target).size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.error("Birleştirme başarısız — fontTools kurulu mu? (pip install fonttools brotli)");
    console.error(String(e.stderr || e.message).split("\n").slice(0, 3).join("\n"));
    process.exit(1);
  }
}
