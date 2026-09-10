// Dil değiştirme — TR · EN · RU
//  - üst barda üç dil de var, mobilde de görünür ve sipariş/iletişim çiftini taşırmıyor
//  - AYNI SAYFADA kalır: /siparis'te dil değişince /ru/siparis'e gider, ana sayfaya ATMAZ
//  - <html lang> doğru, hreflang üçlüsü + x-default var
//  - KİRİL TOFU YOK: Rusça metinler gerçekten çiziliyor (kutu karakter değil)
//  - fiyat biçimi: tr/en "₺3.060" · ru "3 060 ₺"
//  - panel Türkçe kalır (çevrilmedi)
//  - uzun Rusça kelimeler taşırmıyor (buton, sepet çubuğu, başlık)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik: mesaj dosyaları ---- */
const M = Object.fromEntries(["tr", "en", "ru"].map((l) => [l, JSON.parse(readFileSync(path.join(root, `messages/${l}.json`), "utf8"))]));
check("ru.json var", !!M.ru);
check("üç dilde de lang etiketleri", ["tr", "en", "ru"].every((l) => M[l].chrome.lang.ru === "RU"));

/* anahtar yapısı birebir aynı olmalı: eksik anahtar = çalışma zamanında undefined */
const keys = (o, p = "") => {
  const s = new Set();
  if (o && typeof o === "object" && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) {
      if (k === "_acik") continue;
      s.add(`${p}.${k}`);
      for (const x of keys(v, `${p}.${k}`)) s.add(x);
    }
  }
  return s;
};
const kEn = keys(M.en), kRu = keys(M.ru);
const missing = [...kEn].filter((k) => !kRu.has(k) && !k.startsWith(".panel"));
check("ru.json'da eksik anahtar yok", missing.length === 0, missing.slice(0, 4).join(" "));

/* AÇIK işaretleri: RU metinleri onay bekliyor, tek dosyadan düzenlenebilir */
const acik = Object.entries(M.ru).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v) && "_acik" in v).length;
check("RU bölümleri AÇIK ile işaretli", acik >= 10, `${acik} bölüm`);
check("ru.json başında toplu AÇIK notu", typeof M.ru._acik === "string" && /AÇIK/.test(M.ru._acik));

/* panel çevrilmedi: TR ile birebir aynı */
check("panel Türkçe kaldı", JSON.stringify(M.ru.panel) === JSON.stringify(M.tr.panel));

/* ürün adları çevrilmedi (marka), Türkçe SÖZCÜK olanlar çevrildi */
check("SMOOKY/BRISKET çevrilmedi", !M.ru.menuName.smooky && !M.ru.menuName.brisket);
check("Türkçe sözcük olan adlar çevrildi", /[А-Яа-я]/.test(M.ru.menuName["tavuk-taco"] ?? ""), M.ru.menuName["tavuk-taco"]);
check("malzeme adları çevrildi", Object.keys(M.ru.menuIng).length >= 38, `${Object.keys(M.ru.menuIng).length} malzeme`);

/* ---- fontlar: Kiril kapsamı ---- */
const cssSrc = readFileSync(path.join(root, "app/globals.css"), "utf8");
const fontsSrc = readFileSync(path.join(root, "lib/fonts.ts"), "utf8");
/* Tek aile MuseoModerno; Kiril'i yok, o yüzden next/font ile Comfortaa yedeği yükleniyor.
   Eski yerel woff2 + unicode-range düzeni kalktı. */
check("Kiril yedeği tanımlı (Comfortaa)", /Comfortaa\(/.test(fontsSrc) && /"cyrillic"/.test(fontsSrc));
check("MuseoModerno latin-ext ile (Türkçe)", /MuseoModerno\(/.test(fontsSrc) && /"latin-ext"/.test(fontsSrc));
check("MuseoModerno yığında ÖNDE (TR/EN değişmez)", /--font-museo-stack:\s*var\(--font-museo\),\s*var\(--font-cyr\)/.test(cssSrc));

const b = await chromium.launch();
const settle = async (p) => {
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(500);
};

/* ---- 1) ÜST BARDA ÜÇ DİL ---- */
for (const w of [390, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 844 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const langs = await p.$$eval(".lang a", (as) => as.map((a) => ({ t: a.textContent.trim(), href: a.getAttribute("href"), vis: a.getBoundingClientRect().width > 0 })));
  check(`${w}px: üç dil de var`, langs.length === 3 && langs.every((l) => l.vis), langs.map((l) => l.t).join(" "));
  check(`${w}px: RU bağlantısı /ru`, langs.some((l) => l.t === "RU" && l.href === "/ru"), langs.find((l) => l.t === "RU")?.href);
  await p.close();
}

/* ---- 2) AYNI SAYFADA KALIR (asıl istek) ---- */
const SAME = [
  ["/siparis", "RU", "/ru/siparis"],
  ["/siparis", "EN", "/en/siparis"],
  ["/ru/siparis", "TR", "/siparis"],
  ["/ru/siparis/odeme", "TR", "/siparis/odeme"],
  ["/siparis/odeme", "RU", "/ru/siparis/odeme"],
  ["/en/siparis", "RU", "/ru/siparis"],
];
for (const [from, to, want] of SAME) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + from, { waitUntil: "networkidle" });
  await settle(p);
  const href = await p.$eval(`.lang a:text-is("${to}")`, (a) => a.getAttribute("href")).catch(() => null);
  check(`${from} → ${to} bağlantısı ${want}`, href === want, String(href));
  if (href === want) {
    await p.click(`.lang a:text-is("${to}")`);
    await p.waitForURL(`**${want}`, { timeout: 10000 }).catch(() => {});
    const now = new URL(p.url()).pathname;
    check(`${from} → ${to} tıklayınca ${want} (ana sayfaya ATMADI)`, now === want, now);
  }
  await p.close();
}

/* ---- 3) <html lang> + hreflang ---- */
for (const [path_, lang] of [["/", "tr"], ["/en", "en"], ["/ru", "ru"], ["/ru/siparis", "ru"]]) {
  const html = await (await fetch(base + path_)).text();
  const m = html.match(/<html[^>]*lang="([a-z-]+)"/);
  check(`${path_}: <html lang="${lang}">`, m?.[1] === lang, m?.[1]);
}
const head = await (await fetch(base + "/ru/siparis")).text();
for (const l of ["tr", "en", "ru", "x-default"]) {
  check(`hreflang ${l} var`, new RegExp(`hrefLang="${l}"`, "i").test(head));
}
check("hreflang ru doğru yolu gösteriyor", /hrefLang="ru"\s+href="[^"]*\/ru\/siparis"/i.test(head));

/* ---- 4) KİRİL GERÇEKTEN ÇİZİLİYOR (tofu yok) ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/ru/siparis", { waitUntil: "networkidle" });
  await settle(p);
  const r = await p.evaluate(async () => {
    await document.fonts.ready;
    /* Tofu tespiti: Kiril metnin gerçek genişliğini, aynı metnin "kesinlikle Kiril'i olmayan"
       bir aileyle ölçümüyle karşılaştırmak yerine, yüklenen ailelerin Kiril'i kapsayıp
       kapsamadığını canvas ile ölç: her harf ayrı ayrı 0'dan geniş ve hepsi AYNI genişlikte
       değilse (tofu hepsi aynı kutu genişliğini verir) font gerçekten var demektir. */
    const el = [...document.querySelectorAll("h1,h2,h3,p,span,a,button")].find((e) => /[А-Яа-яЁё]{4,}/.test(e.textContent || ""));
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    const c = document.createElement("canvas").getContext("2d");
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ws = [..."АБВГДЕЖЗИЙЛФШЩЮЯ"].map((ch) => c.measureText(ch).width);
    const uniq = new Set(ws.map((x) => Math.round(x * 10)));
    return {
      found: true, family: cs.fontFamily.split(",")[0].replace(/"/g, ""),
      sample: (el.textContent || "").trim().slice(0, 22),
      allPositive: ws.every((x) => x > 0), distinctWidths: uniq.size,
      /* Kiril harfler farklı genişlikte olmalı; tofu kutuları tek genişlik verir */
      looksLikeTofu: uniq.size <= 2,
    };
  });
  check("sayfada Kiril metin var", r.found, r.sample);
  check("Kiril harfler çiziliyor (genişlik > 0)", r.allPositive);
  check("TOFU YOK (harf genişlikleri farklı)", !r.looksLikeTofu, `${r.distinctWidths} farklı genişlik`);
  /* gerçekten yedek aile mi kullanılıyor */
  const used = await p.evaluate(async () => {
    await document.fonts.ready;
    /* document.fonts listesi yarışabiliyor: yüz sayfada kullanılıyor ama listeye geç
       düşebiliyor. Kiril glifini AÇIKÇA istiyoruz — zaten yüklüyse anında döner. */
    await document.fonts.load("400 16px Comfortaa", "Заказать").catch(() => {});
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  /* Bu kontrol RU sayfasında yapılır: Kiril yoksa Comfortaa hiç indirilmez (doğru davranış). */
  check("Kiril yedek yazı tipi yüklendi", used.some((f) => /Comfortaa/.test(f)), used.join(","));
  await p.close();
}

/* ---- 5) FİYAT BİÇİMİ ---- */
for (const [loc, want, label] of [["", /₺3\.060/, "tr ₺3.060"], ["/en", /₺3\.060/, "en ₺3.060"], ["/ru", /3 060 ₺/, "ru 3 060 ₺"]]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(base + loc + "/siparis", { waitUntil: "networkidle" });
  await p.evaluate(() => localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { smooky: { qty: 3, note: "" }, brisket: { qty: 2, note: "" } } })));
  await p.goto(base + loc + "/siparis/odeme", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const txt = await p.evaluate(() => document.body.innerText);
  check(`fiyat biçimi: ${label}`, want.test(txt), (txt.match(/[₺\d .,]{5,12}/g) || []).slice(0, 3).join(" | "));
  await p.close();
}

/* ---- 6) UZUN RUSÇA KELİMELER TAŞIRMIYOR ----
   Ölçüt: RU, TÜRKÇE'ye göre YENİ bir taşma getirmemeli. Mutlak "hiç taşma yok" demiyoruz
   çünkü hero karuseli (DIV.item, IMG.img…) kartları kasıtlı olarak ekran dışında bekletir ve
   kategori şeridi (A.catchip) yatay kaydırılır — ikisi de TR'de de aynı şekilde "taşar".
   Bu yüzden her genişlikte TR ölçülür, RU onunla karşılaştırılır. */
const overflowIn = async (url, w) => {
  const p = await b.newPage({ viewport: { width: w, height: 844 } });
  const home = new URL(url).pathname.replace(/\/siparis.*$/, "") || "/";
  await p.goto(base + (home === "/" ? "/siparis" : home + "/siparis"), { waitUntil: "networkidle" }).catch(() => {});
  await p.evaluate(() => localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { smooky: { qty: 3, note: "" }, brisket: { qty: 2, note: "" } } })));
  await p.goto(url, { waitUntil: "networkidle" });
  await settle(p);
  const r = await p.evaluate(() => {
    const over = [];
    for (const e of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(e);
      if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
      const bb = e.getBoundingClientRect();
      if (bb.width === 0) continue;
      let right = bb.right;
      if (e.children.length === 0 && (e.textContent || "").trim()) {
        const rg = document.createRange();
        rg.selectNodeContents(e);
        for (const rr of rg.getClientRects()) right = Math.max(right, rr.right);
      }
      /* Sınıf adıyla kimliklendir: konum dile göre birkaç piksel oynayabilir, ÖĞE aynı olmalı. */
      if (right > innerWidth + 1) over.push(`${e.tagName}.${(e.className || "").toString().split(" ")[0]}`);
    }
    return { over: [...new Set(over)], scrollW: document.documentElement.scrollWidth, vw: innerWidth };
  });
  await p.close();
  return r;
};

for (const w of [360, 390, 430]) {
  for (const [trPath, ruPath] of [["/", "/ru"], ["/siparis", "/ru/siparis"], ["/siparis/odeme", "/ru/siparis/odeme"]]) {
    const tr = await overflowIn(base + trPath, w);
    const ru = await overflowIn(base + ruPath, w);
    check(`${w}px ${ruPath}: yatay taşma yok`, ru.scrollW <= ru.vw, `${ru.scrollW}/${ru.vw}`);
    const extra = ru.over.filter((x) => !tr.over.includes(x));
    check(`${w}px ${ruPath}: TR'ye göre YENİ taşma yok`, extra.length === 0, extra.join(" ") || `TR ile aynı (${ru.over.length} kasıtlı öğe)`);
  }
}

/* ---- 7) SİPARİŞ + İLETİŞİM çifti RU'da da sığar ---- */
for (const w of [360, 390, 430]) {
  const p = await b.newPage({ viewport: { width: w, height: 844 } });
  await p.goto(base + "/ru", { waitUntil: "networkidle" });
  await settle(p);
  const r = await p.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect();
      return { x: Math.round(b.x), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height), t: e.textContent.trim() }; };
    return { o: g("[data-order-cta]"), c: g("[data-contact-open]"), vw: innerWidth };
  });
  check(`${w}px: RU çifti ekran içinde`, r.o.x >= 0 && r.c.r <= r.vw, `sipariş ${r.o.x}, iletişim sağ ${r.c.r}/${r.vw}`);
  check(`${w}px: RU çifti ≥44 px`, r.o.h >= 44 && r.c.h >= 44, `${r.o.h}/${r.c.h}`);
  check(`${w}px: RU düğmeleri çakışmıyor`, r.c.x >= r.o.r, `arası ${r.c.x - r.o.r}px`);
  await p.close();
}

/* ---- 8) PANEL TÜRKÇE ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/panel", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({ lang: document.documentElement.lang, txt: document.body.innerText.slice(0, 400) }));
  check("panel <html lang=tr>", r.lang === "tr", r.lang);
  check("panelde Kiril yok", !/[А-Яа-я]/.test(r.txt));
  await p.close();
}

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nTÜMÜ GEÇTİ");
process.exit(fail ? 1 : 0);
