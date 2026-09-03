// Preloader: gerçek ilerleme, süpürge, %100 vurgusu, kalkış, rAF beklemesi
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3112";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
let fail = 0; const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };
const errs = []; p.on("pageerror", (e) => errs.push(e.message));

// yavaş ağ: ilerleme adımlarını izleyebilelim
const cdp = await p.context().newCDPSession(p);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 120, downloadThroughput: 900e3 / 8, uploadThroughput: 500e3 / 8 });

const samples = [];
await p.goto(base + "/", { waitUntil: "commit" });
const poll = setInterval(async () => {
  try {
    const s = await p.evaluate(() => {
      const pre = document.querySelector(".pre");
      if (!pre) return { gone: true };
      const cs = getComputedStyle(pre);
      return { p: pre.style.getPropertyValue("--p"), sweep: pre.style.getPropertyValue("--sweep"), cls: pre.className, num: pre.querySelector(".preNum")?.textContent, numOp: pre.querySelector(".preNum")?.style.opacity, logoFilter: getComputedStyle(pre.querySelector(".preLogo")).filter.slice(0, 60), op: cs.opacity };
    });
    samples.push(s);
  } catch {}
}, 40);
await p.waitForTimeout(12000);
clearInterval(poll);

const withPre = samples.filter((s) => !s.gone);
const ps = [...new Set(withPre.map((s) => s.p).filter(Boolean))];
check("ilerleme kademeli (birden fazla ara değer)", ps.length >= 2, "değerler: " + ps.join(", "));
check("süpürge ilerlemeyle ilerler", new Set(withPre.map((s) => s.sweep)).size >= 2, [...new Set(withPre.map((s) => s.sweep))].join(" "));
check("logo soluk başlar (brightness < 1)", withPre.some((s) => /brightness\(0\.\d/.test(s.logoFilter || "")), withPre[0]?.logoFilter);
check("%100'de vurgu sınıfı (pop)", withPre.some((s) => s.cls.includes("pop")));
check("kalkış (gone)", withPre.some((s) => s.cls.includes("gone")) || samples.some((s) => s.gone));
check("preloader DOM'dan kalkar", samples[samples.length - 1].gone === true);
// mag. yazısı yok, logo var
const gone = await p.evaluate(() => ({ mark: !!document.querySelector(".preMark"), img: !!document.querySelector(".pre img") }));
check("eski 'mag.' yazısı yok", gone.mark === false);
console.log("errors:", errs.length ? errs : "none");
await b.close();
process.exit(fail ? 1 : 0);
