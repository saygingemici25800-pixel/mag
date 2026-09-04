// SSS ve BİZE KATIL "reveal": alttan gelen panel + iç parallax + stacked pages
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(600);
let fail = 0; const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const at = async (pr) => {
  await p.evaluate((v) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(v * max)); }, pr);
  await p.waitForTimeout(1700);
  return p.evaluate(() => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { tf: e.style.transform, op: e.style.opacity, filter: e.style.filter, r: cs.borderTopLeftRadius, bt: cs.borderTopWidth }; };
    return { faq: g(".scFaq"), faqInner: g(".scFaq .panelInner"), foot: g(".scFoot"), footInner: g(".scFoot .panelInner"), veil: document.querySelector(".panelVeil")?.style.opacity };
  });
};
const pre = await at(0.78);   // SSS öncesi
const mid = await at(0.80);   // SSS girişi ortası
const faqFull = await at(0.835);
const footMid = await at(0.872); // BİZE KATIL girişi ortası
check("SSS öncesi panel ekran dışında (translateY büyük)", parseFloat(pre.faq.tf.match(/translateY\(([-\d.]+)px/)?.[1] ?? 0) > 400, pre.faq.tf);
const midY = parseFloat(mid.faq.tf.match(/translateY\(([-\d.]+)px/)?.[1] ?? 0);
check("giriş ortasında panel yarı yolda", midY > 20 && midY < 700, `translateY=${midY.toFixed(0)}px`);
check("iç kapsayıcı parallax (negatif %)", parseFloat(mid.faqInner.tf.match(/translateY\(([-\d.]+)%/)?.[1] ?? 0) < 0, mid.faqInner.tf);
check("panel opaklığı 1 (fade değil)", mid.faq.op === "1", "opacity=" + mid.faq.op);
check("arka sahneye perde", parseFloat(mid.veil ?? "0") > 0.1, "veil=" + mid.veil);
check("panel üst köşe radius 18px", faqFull.faq.r === "18px", faqFull.faq.r);
check("üst çizgi 1px", faqFull.faq.bt === "1px", faqFull.faq.bt);
// BİZE KATIL binince SSS küçülüp kararır
const sc = parseFloat(footMid.faq.tf.match(/scale\(([\d.]+)\)/)?.[1] ?? 1);
const br = parseFloat(footMid.faq.filter.match(/brightness\(([\d.]+)\)/)?.[1] ?? 1);
check("SSS altta kalınca küçülür (scale<1)", sc < 0.995, `scale=${sc.toFixed(3)}`);
check("SSS altta kalınca kararır (brightness<1)", br < 0.98, `brightness=${br.toFixed(3)}`);
const footY = parseFloat(footMid.foot.tf.match(/translateY\(([-\d.]+)px/)?.[1] ?? 0);
check("BİZE KATIL alttan geliyor", footY > 20 && footY < 700, `translateY=${footY.toFixed(0)}px`);
await b.close();
process.exit(fail ? 1 : 0);
