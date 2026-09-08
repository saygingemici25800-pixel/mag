// Üst bar: SİPARİŞ + İLETİŞİM çifti
//  - MOBİLDE GÖRÜNÜR: 390/430/768 px'te iki düğme de ölçülebilir boyutta, ekran içinde
//  - tıklanınca /siparis'e gider (TR) ve /en/siparis'e gider (EN)
//  - dokunma hedefi ≥44 px, yatay taşma yok, birbirleriyle ve TR|EN ile çakışmıyor
//  - çift gibi durur: aynı yükseklik, aynı üst kenar, aynı tipografi
//  - sipariş kapalıyken pasif görünür ve "Şu an kapalıyız" der
//
// Gerileme koruması: bu düğme bir kez ".menu span { display:none }" yüzünden mobilde
// 0×0 px'e düşmüştü. Aşağıdaki genişlik/yükseklik kontrolleri o hatayı tekrar yakalar.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
const KEY = process.env.PANEL_KEY ?? "test1234";
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik: metin veriden gelir, bileşene gömülü değil ---- */
const tr = JSON.parse(readFileSync(path.join(root, "messages/tr.json"), "utf8"));
const en = JSON.parse(readFileSync(path.join(root, "messages/en.json"), "utf8"));
check("TR etiketi Sipariş", tr.chrome.menu === "Sipariş", tr.chrome.menu);
check("EN etiketi Order", en.chrome.menu === "Order", en.chrome.menu);
check("TR kapalı metni var", tr.chrome.closedNow === "Şu an kapalıyız", tr.chrome.closedNow);
check("TR kısa kapalı metni var", typeof tr.chrome.closedNowShort === "string" && tr.chrome.closedNowShort.length > 0, tr.chrome.closedNowShort);
check("EN kısa kapalı metni var", typeof en.chrome.closedNowShort === "string" && en.chrome.closedNowShort.length > 0, en.chrome.closedNowShort);
check("EN kapalı metni var", typeof en.chrome.closedNow === "string" && en.chrome.closedNow.length > 0, en.chrome.closedNow);
const ctaSrc = readFileSync(path.join(root, "components/chrome/OrderCta.tsx"), "utf8");
check("etiket bileşene gömülü değil", !ctaSrc.includes("Sipariş") && !ctaSrc.includes('"Order"'));
const chromeSrc = readFileSync(path.join(root, "components/chrome/Chrome.tsx"), "utf8");
check("hedef /siparis", ctaSrc.includes('"/siparis"') && !chromeSrc.includes('"/menu"'));
/* düğmeyi mobilde gizleyen eski kural geri gelmesin */
const css = readFileSync(path.join(root, "components/chrome/chrome.css"), "utf8");
check("'.menu span{display:none}' kuralı kalmadı", !/\.menu\s+span\s*\{[^}]*display:\s*none/.test(css));
check("mobil blokta .cta gizlenmiyor", !/\.cta\s*\{[^}]*display:\s*none/.test(css));

const b = await chromium.launch();

/* preloader'ı bekle: z-90 katmanı tıklamayı yutar */
const settle = async (p) => {
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(400);
};
const box = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  const c = getComputedStyle(e);
  return {
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    right: Math.round(r.right), bottom: Math.round(r.bottom),
    display: c.display, visibility: c.visibility, opacity: c.opacity,
    fs: parseFloat(c.fontSize), ff: c.fontFamily, radius: c.borderRadius,
    text: (e.textContent || "").trim(),
  };
}, sel);

/* ---- 1) MOBİL GÖRÜNÜRLÜK — asıl mesele ---- */
for (const w of [390, 430, 768]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await settle(p);

  const o = await box(p, "[data-order-cta]");
  const c = await box(p, "[data-contact-open]");
  check(`${w}px: SİPARİŞ DOM'da`, !!o);
  check(`${w}px: SİPARİŞ görünür (0×0 değil)`, !!o && o.w > 0 && o.h > 0, o ? `${o.w}×${o.h}` : "yok");
  check(`${w}px: SİPARİŞ gizlenmemiş`, !!o && o.display !== "none" && o.visibility !== "hidden" && o.opacity !== "0");
  check(`${w}px: metin 'Sipariş'`, o?.text === "Sipariş", o?.text);
  check(`${w}px: İLETİŞİM görünür`, !!c && c.w > 0 && c.h > 0, c ? `${c.w}×${c.h}` : "yok");

  /* dokunma hedefi */
  check(`${w}px: SİPARİŞ dokunma ≥44 px`, o.h >= 44, `${o.h} px`);
  check(`${w}px: İLETİŞİM dokunma ≥44 px`, c.h >= 44, `${c.h} px`);

  /* çift gibi dursun */
  check(`${w}px: aynı yükseklik`, o.h === c.h, `${o.h} vs ${c.h}`);
  check(`${w}px: aynı üst kenar`, o.y === c.y, `${o.y} vs ${c.y}`);
  check(`${w}px: aynı yazı boyutu`, o.fs === c.fs, `${o.fs} vs ${c.fs}`);
  check(`${w}px: aynı tipografi (Comico)`, o.ff === c.ff && /comico/i.test(o.ff), o.ff.split(",")[0]);

  /* kesilme / taşma / çakışma */
  const env = await p.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth, vw: innerWidth,
    boxes: [".lang", ".onbox", ".mark"].map((s) => {
      const e = document.querySelector(s);
      if (!e || getComputedStyle(e).display === "none") return null;
      const r = e.getBoundingClientRect();
      return { s, x: r.x, y: r.y, right: r.right, bottom: r.bottom, top: r.top, left: r.left };
    }).filter(Boolean),
  }));
  check(`${w}px: ekran içinde, kesilmiyor`, o.x >= 0 && c.right <= env.vw, `sipariş sol ${o.x}, iletişim sağ ${c.right}/${env.vw}`);
  check(`${w}px: yatay taşma yok`, env.scrollW <= env.vw, `${env.scrollW} vs ${env.vw}`);
  check(`${w}px: iki düğme üst üste binmiyor`, c.x >= o.right, `arası ${c.x - o.right} px`);

  const ov = (a, r2) => !(a.right <= r2.left || r2.right <= a.left || a.bottom <= r2.top || r2.bottom <= a.top);
  const oRect = { left: o.x, right: o.right, top: o.y, bottom: o.bottom };
  const cRect = { left: c.x, right: c.right, top: c.y, bottom: c.bottom };
  for (const other of env.boxes) {
    check(`${w}px: ${other.s} ile çakışmıyor`, !ov(oRect, other) && !ov(cRect, other));
  }

  /* köşe braketleri çifti kesmesin */
  const brk = await p.evaluate(() => {
    const o = document.querySelector("[data-order-cta]").getBoundingClientRect();
    const c = document.querySelector("[data-contact-open]").getBoundingClientRect();
    const ov = (a, r) => !(a.right <= r.left || r.right <= a.left || a.bottom <= r.top || r.bottom <= a.top);
    return [...document.querySelectorAll(".bracket")].some((b) => ov(o, b.getBoundingClientRect()) || ov(c, b.getBoundingClientRect()));
  });
  check(`${w}px: köşe braketleriyle çakışmıyor`, !brk);

  /* gerçekten tıklanabilir: üstünde başka katman yok */
  const hit = await p.evaluate(() => {
    const e = document.querySelector("[data-order-cta]");
    const r = e.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return e === t || e.contains(t) ? "OK" : `${t?.tagName}.${t?.className}`;
  });
  check(`${w}px: üstünde katman yok`, hit === "OK", hit);
  await p.close();
}

/* ---- 2) TIKLAYINCA SİPARİŞ SAYFASINA GİDER ---- */
for (const [w, url, want, label] of [[390, "/", "/siparis", "mobil TR"], [1440, "/", "/siparis", "masaüstü TR"], [390, "/en", "/en/siparis", "mobil EN"]]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto(base + url, { waitUntil: "networkidle" });
  await settle(p);
  check(`${label}: href ${want}`, (await p.getAttribute("[data-order-cta]", "href")) === want, await p.getAttribute("[data-order-cta]", "href"));
  await p.click("[data-order-cta]");
  await p.waitForURL(`**${want}`, { timeout: 10000 }).catch(() => {});
  check(`${label}: tıklayınca ${want} açıldı`, new URL(p.url()).pathname === want, new URL(p.url()).pathname);
  /* sipariş sayfası gerçekten yüklendi mi */
  check(`${label}: sipariş sayfası yüklendi`, (await p.locator("[data-menu-item], .ord").count()) > 0);
  await p.close();
}

/* ---- 3) SİPARİŞ KAPALIYKEN ---- */
const login = await fetch(base + "/api/panel/login", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: KEY }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const patch = (open) => fetch(base + "/api/panel/settings", {
  method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ ordering_open: open }),
});
check("panel girişi (ayar değiştirmek için)", login.ok && cookie.length > 0);

if (cookie) {
  await patch(false);
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.goto(base + "/", { waitUntil: "networkidle" });
  const appeared = await p.waitForSelector('[data-order-cta][data-closed="1"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check("kapalıyken düğme pasif duruma geçti", appeared);
  if (appeared) {
    const cl = await box(p, "[data-order-cta]");
    /* mobilde kısa etiket görünür, ekran okuyucu tam cümleyi duyar */
    const lab = await p.evaluate(() => {
      const e = document.querySelector("[data-order-cta]");
      const vis = (s) => { const x = e.querySelector(s); return x && getComputedStyle(x).display !== "none" ? x.textContent.trim() : null; };
      return { shown: vis(".cta-short") ?? vis(".cta-long"), aria: e.getAttribute("aria-label") };
    });
    check("mobilde kısa etiket görünüyor", lab.shown === tr.chrome.closedNowShort, lab.shown);
    check("ekran okuyucu tam cümleyi duyuyor", lab.aria === "Şu an kapalıyız", lab.aria);
    check("kapalıyken de ≥44 px", cl.h >= 44, `${cl.h} px`);
    check("kapalıyken ekranda kalıyor", cl.x >= 0 && cl.right <= 390, `${cl.x}–${cl.right}`);
    const a = await p.evaluate(() => {
      const e = document.querySelector("[data-order-cta]");
      const c = getComputedStyle(e);
      return { aria: e.getAttribute("aria-disabled"), cursor: c.cursor, bg: c.backgroundColor, href: e.getAttribute("href") };
    });
    check("kapalıyken aria-disabled", a.aria === "true", a.aria);
    check("kapalıyken imleç not-allowed", a.cursor === "not-allowed", a.cursor);
    check("kapalıyken dolgu kalkmış (pasif görünüm)", a.bg === "rgba(0, 0, 0, 0)", a.bg);
    check("kapalıyken bağlantı yine /siparis (menü görülebilsin)", a.href === "/siparis", a.href);
    const noOverflow = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check("kapalıyken yatay taşma yok", noOverflow);
    /* TR|EN ayıracı .lang kutusunun DIŞINA taşan bir glif; kutu kontrolü bunu kaçırmıştı,
       bu yüzden ayıracın kendi kutusu ölçülür. */
    const clash = await p.evaluate(() => {
      const e = document.querySelector("[data-order-cta]").getBoundingClientRect();
      return [...document.querySelectorAll(".lang i, .lang a")].some((x) => {
        const r = x.getBoundingClientRect();
        return !(e.right <= r.left || r.right <= e.left || e.bottom <= r.top || r.bottom <= e.top);
      });
    });
    check("kapalıyken TR|EN ayıracıyla çakışmıyor", !clash);
  }
  await p.close();
  await patch(true);

  /* geri açıldığını doğrula: test kalıcı yan etki bırakmasın */
  const back = await (await fetch(base + "/api/panel/settings")).json();
  check("ayar geri açıldı (test yan etki bırakmıyor)", back.ordering_open === true);
}

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nTÜMÜ GEÇTİ");
process.exit(fail ? 1 : 0);
