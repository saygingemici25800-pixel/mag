// Müşteri yorumları bölümü
//  - SSS'ten SONRA, BİZE KATIL'dan ÖNCE
//  - BOYUT: SSS bloğunun ~yarısı kadar dikey yer (asıl kısıt)
//  - metinler lib/testimonials.ts ile BİREBİR aynı (uydurma/değiştirme yok)
//  - üç dilde de yorum metni TÜRKÇE kalır; yalnızca başlık ve kaynak satırı çevrilir
//  - portre yok: makarada kendi ürün kesimlerimiz
//  - uzun yorumlar taşmıyor, mobilde okunur
//  - makara yalnızca görünürken döner (kare süresi), reduced-motion'da hiç dönmez
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapP } from "./_segments.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik: veri dosyası ---- */
const src = readFileSync(path.join(root, "lib/testimonials.ts"), "utf8");
/* yorum bloğu satırlara bölünüp "*" ile başlıyor: karşılaştırmadan önce düzleştir */
const flat = src.replace(/\s*\n\s*\*?\s*/g, " ");
check("dosya başında kaynak notu var", /Google Haritalar'daki gerçek müşteri yorumlarından alınmıştır/.test(flat) && /Metinler değiştirilmez, yeni yorum eklenmez/.test(flat));
const quotes = [...src.matchAll(/quote:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
const authors = [...src.matchAll(/author:\s*"([^"]+)"/g)].map((m) => m[1]);
check("5 yorum var", quotes.length === 5, `${quotes.length}`);
/* verilen metinlerle BİREBİR — tek karakter değişse burada patlar */
const WANT = [
  ["Dalaman'dan Fethiye'ye bu hamburgerleri yemek için gittim ve hiç pişman etmediler.", "Yunus Emre Karcı"],
  ["Mag Berry ve Mag Classic yedik, ikisi de çok lezzetliydi. İşletmecileri çok ilgililer ve işlerine çok hakimler. Kesinlikle tavsiye ederiz.", "Esra Bülbül"],
  ["Şahane mekan, burgerler çok lezzetli ve doyurucu. Ekmeklerini kendileri yapıyorlar, soğan halkası ev yapımı çıtır çıtır.", "Caner Özkan"],
  ["Burgerler gerçekten lezzetliydi. Mag Berry ve Mag Classic tercih ettik. Çalışanlar da gayet ilgiliydi.", "Yerel Rehber"],
  ["Ekmeklerin el yapımı olduğu belli ve tat olarak farklılığı anlayabiliyorsunuz. Tiftik eti gerçekten çok lezzetliydi.", "Yerel Rehber"],
];
WANT.forEach(([q, a], i) => {
  check(`yorum ${i + 1} metni birebir`, quotes[i] === q, quotes[i] === q ? "" : `beklenen "${q.slice(0, 30)}…" geldi "${(quotes[i] ?? "").slice(0, 30)}…"`);
  check(`yorum ${i + 1} yazarı birebir`, authors[i] === a, authors[i]);
});
/* başlık/kaynak üç dilde çevrildi, yorum METNİ çevrilmedi */
const M = Object.fromEntries(["tr", "en", "ru"].map((l) => [l, JSON.parse(readFileSync(path.join(root, `messages/${l}.json`), "utf8"))]));
check("başlık üç dilde de var", ["tr", "en", "ru"].every((l) => Array.isArray(M[l].testimonials?.title) && M[l].testimonials.title.length === 2));
check("kaynak satırı üç dilde de var", ["tr", "en", "ru"].every((l) => typeof M[l].testimonials?.source === "string"));
check("TR başlığı MÜŞTERİLER NE DİYOR", M.tr.testimonials.title.join(" ") === "MÜŞTERİLER NE DİYOR", M.tr.testimonials.title.join(" "));
check("başlıklar gerçekten çevrilmiş (üçü farklı)", new Set(["tr", "en", "ru"].map((l) => M[l].testimonials.title.join(" "))).size === 3);
check("yorum metinleri messages'a KOPYALANMAMIŞ", !["tr", "en", "ru"].some((l) => JSON.stringify(M[l]).includes("Dalaman'dan Fethiye")));

const b = await chromium.launch();
const settle = async (p) => {
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(400);
};
const goFaq = async (p, mobile) => {
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, Math.round(v * m)); }, mapP(0.835, mobile));
  await p.waitForTimeout(1200);
};

/* ---- BOYUT: SSS'in ~yarısı ---- */
for (const [w, h, label] of [[1440, 900, "masaüstü"], [390, 844, "mobil"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  await goFaq(p, w < 820);
  const r = await p.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); if (!e) return null; const bb = e.getBoundingClientRect();
      return { h: Math.round(bb.height), top: Math.round(bb.top), bot: Math.round(bb.bottom) }; };
    const inner = document.querySelector(".scFaq .panelInner");
    return { faq: g(".faqlist"), tst: g(".tst"), inner: inner ? Math.round(inner.getBoundingClientRect().height) : null, vh: innerHeight };
  });
  check(`${label}: bölüm var`, !!r.tst);
  const oran = r.tst.h / r.faq.h;
  /* "yaklaşık yarısı": 0.40–0.65 bandı. Üst sınır aşılırsa sayfa şişiyor demektir. */
  check(`${label}: SSS'in ~yarısı`, oran >= 0.4 && oran <= 0.65, `SSS ${r.faq.h}px · yorumlar ${r.tst.h}px → ${oran.toFixed(2)}`);
  check(`${label}: SSS'ten SONRA`, r.tst.top >= r.faq.bot, `yorumlar üst ${r.tst.top} vs SSS alt ${r.faq.bot}`);
  check(`${label}: panel taşmıyor`, r.inner <= r.vh, `panelInner ${r.inner} / vh ${r.vh}`);
  await p.close();
}

/* ---- SIRA: SSS → yorumlar → BİZE KATIL ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  const order = await p.evaluate(() => {
    const all = [...document.querySelectorAll("*")];
    const idx = (sel) => all.indexOf(document.querySelector(sel));
    return { faq: idx(".faqlist"), tst: idx(".tst"), foot: idx(".scFoot") };
  });
  check("DOM sırası: SSS < yorumlar < BİZE KATIL", order.faq < order.tst && order.tst < order.foot, JSON.stringify(order));
  await p.close();
}

/* ---- İÇERİK: DOM'daki metin veriyle aynı, portre yok ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  await goFaq(p, false);
  const r = await p.evaluate(async () => {
    const seen = [];
    const dots = [...document.querySelectorAll(".tst-dot")];
    for (let i = 0; i < dots.length; i++) {
      dots[i].click();
      await new Promise((r) => setTimeout(r, 280));
      const bq = document.querySelector(".tst-quote blockquote");
      const cap = document.querySelector(".tst-quote figcaption");
      const chars = [...bq.querySelectorAll(".tst-ch")];
      const box = bq.getBoundingClientRect();
      const görünen = chars.filter((c) => { const rr = c.getBoundingClientRect(); return rr.bottom <= box.bottom + 1 && rr.width > 0; }).length;
      seen.push({ metin: (bq.querySelector(".sr-only")?.textContent || "").trim(), yazar: cap.textContent.trim(), toplam: chars.length, görünen });
    }
    const imgs = [...document.querySelectorAll(".tst-reel img")].map((i) => i.getAttribute("src"));
    return { seen, imgs, dots: dots.length, srcHref: document.querySelector(".tst-src")?.getAttribute("href") };
  });
  check("her yorum için gösterge var", r.dots === 5, `${r.dots}`);
  r.seen.forEach((s, i) => {
    check(`ekranda yorum ${i + 1} birebir`, s.metin === WANT[i][0], s.metin.slice(0, 34));
    check(`ekranda yazar ${i + 1}`, s.yazar.toLocaleUpperCase("tr-TR") === WANT[i][1].toLocaleUpperCase("tr-TR"), s.yazar);
    /* uzun yorum kırpılmasın: görünen harf sayısı toplamla aynı olmalı */
    check(`yorum ${i + 1} TAM görünüyor (kırpılmıyor)`, s.görünen === s.toplam, `${s.görünen}/${s.toplam} harf`);
  });
  /* Varlık düzeni değişti: /assets/cut → /urun (dosya adı = ürün id'si). */
  check("makarada yalnızca kendi ürün fotoğraflarımız", r.imgs.length > 0 && r.imgs.every((s) => /^\/urun\//.test(s)), r.imgs.slice(0, 2).join(" "));
  check("portre/avatar yok", !r.imgs.some((s) => /avatar|face|person|portrait|unsplash|pravatar/i.test(s)));
  check("kaynak bağlantısı Google Haritalar", /google\.com\/maps/.test(r.srcHref ?? ""), (r.srcHref ?? "").slice(0, 42));
  await p.close();
}

/* ---- ÜÇ DİLDE: yorum TÜRKÇE, başlık çevrili ---- */
for (const [loc, ln] of [["", "tr"], ["/en", "en"], ["/ru", "ru"]]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + loc + "/", { waitUntil: "networkidle" });
  await settle(p);
  await goFaq(p, false);
  const r = await p.evaluate(() => ({
    başlık: document.querySelector(".tst-title")?.textContent.trim(),
    kaynak: document.querySelector(".tst-src")?.textContent.trim(),
    yorum: (document.querySelector(".tst-quote .sr-only")?.textContent || "").trim(),
  }));
  check(`${ln}: başlık çevrildi`, r.başlık === M[ln].testimonials.title.join(" "), r.başlık);
  check(`${ln}: kaynak satırı çevrildi`, r.kaynak === M[ln].testimonials.source, r.kaynak);
  check(`${ln}: yorum TÜRKÇE kaldı`, r.yorum === WANT[0][0], r.yorum.slice(0, 34));
  await p.close();
}

/* ---- MOBİLDE OKUNUR + TAŞMA YOK ---- */
for (const w of [360, 390, 430]) {
  const p = await b.newPage({ viewport: { width: w, height: 844 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  await goFaq(p, true);
  const r = await p.evaluate(() => {
    const t = document.querySelector(".tst");
    const bq = document.querySelector(".tst-quote blockquote");
    const cs = getComputedStyle(bq);
    const bb = t.getBoundingClientRect();
    /* bölümün içinde ekran dışına boyanan bir şey var mı */
    const over = [...t.querySelectorAll("*")].filter((e) => {
      const r2 = e.getBoundingClientRect();
      return r2.width > 0 && (r2.right > innerWidth + 1 || r2.left < -1);
    }).map((e) => e.className.toString().split(" ")[0]);
    return { left: Math.round(bb.left), right: Math.round(bb.right), vw: innerWidth,
      fs: parseFloat(cs.fontSize), over: [...new Set(over)], scrollW: document.documentElement.scrollWidth };
  });
  check(`${w}px: bölüm ekran içinde`, r.left >= 0 && r.right <= r.vw, `${r.left}–${r.right}/${r.vw}`);
  check(`${w}px: bölümde taşan öğe yok`, r.over.length === 0, r.over.join(" "));
  check(`${w}px: yatay taşma yok`, r.scrollW <= r.vw, `${r.scrollW}/${r.vw}`);
  /* okunabilirlik: mobilde gövde en az 13 px */
  check(`${w}px: yorum ≥13 px (okunur)`, r.fs >= 13, `${r.fs}px`);
  await p.close();
}

/* ---- KARE SÜRESİ: makara yalnızca görünürken döner ---- */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);
  /* Bekleme 1800 ms: sahne scroll'u rAF ile yumuşatıyor; ölçüm, panelin opaklık 0→1
     geçişinin ~1.6 sn sürdüğünü gösterdi. 1000 ms'de panel daha görünmez oluyordu ve
     "görünürken dönüyor" kontrolü haksız yere patlıyordu. */
  const at = async (v) => { await p.evaluate((x) => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, Math.round(x * m)); }, mapP(v, false)); await p.waitForTimeout(1800); };
  const state = () => p.evaluate(() => {
    const t = document.querySelector(".tst"); const tr = document.querySelector(".tst-track");
    return { run: t?.getAttribute("data-run"), play: tr ? getComputedStyle(tr).animationPlayState : null };
  });
  await at(0.3);
  let s = await state();
  check("uzaktayken makara DURUYOR", s.run === "0" && s.play === "paused", JSON.stringify(s));
  await at(0.835);
  s = await state();
  check("görünürken makara dönüyor", s.run === "1" && s.play === "running", JSON.stringify(s));
  await at(0.995);
  s = await state();
  /* panel opacity:0 iken de durmalı — IntersectionObserver tek başına yakalamıyordu */
  check("panel görünmezken makara DURUYOR", s.play === "paused", JSON.stringify(s));
  await p.close();
}

/* ---- prefers-reduced-motion: makara yok, metin sabit ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const bqs = [...document.querySelectorAll("blockquote")];
    const running = [...document.querySelectorAll("*")].some((e) => {
      const a = getComputedStyle(e).animationName;
      return a && a !== "none" && /tstReel|tstChar/.test(a);
    });
    return { sayı: bqs.length, metinler: bqs.map((b) => b.textContent.trim()), makaraVar: !!document.querySelector(".tst-track"), animasyon: running };
  });
  check("reduced-motion: tüm yorumlar sabit listede", r.sayı === 5, `${r.sayı}`);
  check("reduced-motion: metinler tam", r.metinler.every((m, i) => m === WANT[i][0]), r.metinler[0]?.slice(0, 30));
  check("reduced-motion: makara animasyonu yok", !r.animasyon && !r.makaraVar);
  await ctx.close();
}

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nTÜMÜ GEÇTİ");
process.exit(fail ? 1 : 0);
