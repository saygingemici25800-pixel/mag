// İLETİŞİM katmanı: aynı sayfada overlay (rota yok) — açılma/kapanma, ESC, dışarı tıklama, odak dönüşü,
// scroll kilidi ve kalkması (p korunur, preloader tekrar oynamaz), dört mesafe satırı, harita href'i, reduced-motion.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/contact";
mkdirSync(out, { recursive: true });
const MAPS = "https://www.google.com/maps?client=safari&rls=en&oe=UTF-8&um=1&ie=UTF-8&fb=1&gl=tr&sa=X&geocode=KUkHsT2AQcAUMZbi0O5D2WjW&daddr=Cumhuriyet,+Atatürk+Cd.+No:24,+48303,+48000+Fethiye/Muğla";
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const fresh = async (b, opts = {}) => {
  const p = await b.newPage({ viewport: { width: opts.w ?? 1440, height: opts.h ?? 860 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600);
  return p;
};
const state = (p) => p.evaluate(() => document.querySelector(".contact[role=dialog]")?.dataset.state ?? "none");
const scene = (p) => p.evaluate(() => ({ y: window.scrollY, tf: document.querySelector(".item.focus")?.style.transform ?? "", pre: !!document.querySelector(".pre"), ovf: getComputedStyle(document.documentElement).overflow }));
/* 12 Eyl 2026: sahne yumuşatma döngüsü (stageMath SMOOTHING) sabit bir süre sonra
   DEĞİL, hedefe yaklaştıkça durur. Sabit 1800 ms bekleyip örnek almak kararsızdı:
   "before" bazen 219 px, bazen 314 px, bazen −201 px çıkıyordu (aynı konumda).
   Bu yüzden artık SÜRE değil, DURGUNLUK bekliyoruz: transform 3 ardışık örnekte
   (150 ms arayla) 0,2 px'ten az değişince yakınsamış sayılır. */
const settleScene = async (p, timeout = 12000) => {
  const read = () => p.evaluate(() => document.querySelector(".item.focus")?.style.transform ?? "");
  const num = (t) => [...String(t).matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const t0 = Date.now();
  let prev = num(await read()), stable = 0;
  while (Date.now() - t0 < timeout) {
    await p.waitForTimeout(150);
    const cur = num(await read());
    const same = cur.length === prev.length && cur.every((v, i) => Math.abs(v - prev[i]) < 0.2);
    stable = same ? stable + 1 : 0;
    prev = cur;
    if (stable >= 3) return true;
  }
  return false;
};

const b = await chromium.launch();
for (const vp of [{ w: 1440, h: 860 }, { w: 390, h: 844 }]) {
  const tag = `${vp.w}`;
  const p = await fresh(b, vp);
  /* sahnenin ortasında aç: p korunmalı */
  await p.evaluate(() => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, Math.round(0.42 * m)); });
  await p.waitForTimeout(600);
  check(`${tag} sahne yakınsadı (örnek öncesi)`, await settleScene(p));
  const before = await scene(p);
  await p.click("[data-contact-open]");
  await p.waitForTimeout(150);
  check(`${tag} açılınca dialog var (rol/aria-modal)`, await p.evaluate(() => { const d = document.querySelector(".contact"); return d?.getAttribute("role") === "dialog" && d?.getAttribute("aria-modal") === "true"; }));
  check(`${tag} URL değişmedi (ayrı rota yok)`, new URL(p.url()).pathname === "/", p.url());
  check(`${tag} açıkken scroll kilitli`, (await scene(p)).ovf === "hidden");
  await p.waitForFunction(() => document.querySelector(".contact")?.dataset.state === "open", null, { timeout: 8000 }).catch(() => {});
  check(`${tag} açılış animasyonu tamamlandı (state=open)`, (await state(p)) === "open", await state(p));
  await p.screenshot({ path: `${out}/${tag}-acik.png` });
  const panels = await p.evaluate(() => [...document.querySelectorAll(".cPanel")].map((e) => { const r = e.getBoundingClientRect(); return e.classList.contains("top") ? r.height : r.width; }));
  check(`${tag} altı panel de açıldı (0 boyut)`, panels.length === 6 && panels.every((v) => v < 1), panels.map((v) => v | 0).join(","));
  check(`${tag} odak katmanın içinde`, await p.evaluate(() => !!document.activeElement?.closest(".contact")));
  /* içerik */
  const walk = await p.$$eval(".cWalk li", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  check(`${tag} dört yürüme satırı`, walk.length === 4 && /Balık Pazarı.*4/.test(walk[0]) && /Ece Marina.*9/.test(walk[3]), walk.join(" | "));
  const hrefs = await p.$$eval("a[data-maps]", (els) => els.map((a) => [a.getAttribute("href"), a.target, a.rel]));
  check(`${tag} harita linki birebir (adres + buton)`, hrefs.length >= 2 && hrefs.every(([h, t, r]) => h === MAPS && t === "_blank" && /noopener/.test(r) && /noreferrer/.test(r)), JSON.stringify(hrefs[0]));
  check(`${tag} "YOL TARİFİ AL" butonu pin ikonlu`, await p.evaluate(() => { const a = document.querySelector("a.cMaps"); return !!a && /YOL TARİFİ AL|GET DIRECTIONS/.test(a.textContent) && !!a.querySelector("svg"); }));
  /* odak tuzağı: Tab ile katmandan çıkılmıyor */
  for (let i = 0; i < 14; i++) await p.keyboard.press("Tab");
  check(`${tag} odak tuzağı (14 Tab sonrası hâlâ içeride)`, await p.evaluate(() => !!document.activeElement?.closest(".contact")));
  /* sahnenin ok tuşları katmana sızmasın */
  const focusBefore = (await scene(p)).tf;
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(700);
  check(`${tag} ok tuşu sahneyi değiştirmedi`, (await scene(p)).tf === focusBefore);
  /* ESC ile kapan */
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector(".contact"), null, { timeout: 8000 }).catch(() => {});
  check(`${tag} ESC kapattı`, (await state(p)) === "none");
  await settleScene(p);
  const after = await scene(p);
  check(`${tag} kapanınca scroll kilidi kalktı`, after.ovf !== "hidden", after.ovf);
  /* 12 Eyl 2026: transform STRING'i birebir karşılaştırmak kararsızdı. Sahnenin
     yumuşatma döngüsü (stageMath SMOOTHING) bu konumda tam yakınsamıyor: settle
     sonrası ardışık örneklerde 314.3 ↔ 314.4 px gibi 0,1 px salınım ölçüldü
     (değişiklikten ÖNCEKİ sürümde aynı yerde 6 farklı değer görüldü — yani
     kararsızlık eskiden beri var, katmanla ilgisi yok).
     Ölçüt artık SAYISAL: katman kapanınca scroll birebir aynı olmalı, sahne de
     1 px toleransla aynı yerde durmalı (katman sahneyi kaydırmadı). Artık iki örnek
     de settleScene ile yakınsamış durumda alındığı için 1 px yeterli; gerçek bir
     kayma olsa onlarca px olurdu. */
  const nums = (t) => [...String(t).matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const a0 = nums(before.tf), a1 = nums(after.tf);
  const sameShape = a0.length === a1.length;
  const within = sameShape && a0.every((v, i) => Math.abs(v - a1[i]) <= 1);
  check(`${tag} scroll konumu ve sahne p aynen (±1 px)`, after.y === before.y && within, `y ${before.y}→${after.y} · tf ${before.tf} → ${after.tf}`);
  check(`${tag} preloader tekrar oynamadı`, !after.pre);
  check(`${tag} odak İLETİŞİM butonuna döndü`, await p.evaluate(() => document.activeElement?.hasAttribute("data-contact-open")));
  /* dışarı tıklayınca kapan */
  await p.click("[data-contact-open]");
  await p.waitForFunction(() => document.querySelector(".contact")?.dataset.state === "open", null, { timeout: 8000 }).catch(() => {});
  await p.mouse.click(vp.w - 12, vp.h - 12);
  await p.waitForFunction(() => !document.querySelector(".contact"), null, { timeout: 8000 }).catch(() => {});
  check(`${tag} dışarı tıklama kapattı`, (await state(p)) === "none");
  await p.close();
}
/* reduced-motion: anında açık, panel/satır hareketi yok */
{
  const p = await fresh(b, { reduced: true });
  await p.click("[data-contact-open]");
  await p.waitForTimeout(80);
  check("reduced-motion: anında open", (await state(p)) === "open", await state(p));
  const anim = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.(".contact")).length);
  check("reduced-motion: katmanda animasyon yok", anim === 0, `animasyon=${anim}`);
  await p.screenshot({ path: `${out}/1440-reduced.png` });
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  check("reduced-motion: ESC anında kapattı", (await state(p)) === "none");
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
