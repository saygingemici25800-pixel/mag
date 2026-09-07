// SSS akordiyonu + iddia başlıkları
//  - soruya tıklayınca cevap açılır, tekrar tıklayınca kapanır
//  - birden fazla soru aynı anda açık kalabilir
//  - klavye: Tab ile gezilir, Enter ve Space açıp kapatır
//  - aria-expanded doğru, cevap aria-controls ile bağlı
//  - işaret + → × (45° döner)
//  - iddia başlıkları CLAIMS verisinden gelir: DOKU · KARAKTER · KATMAN · DENGE
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapP, segmentsFor } from "./_segments.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const root = process.argv[3] ?? process.env.ROOT ?? "/Users/saygin/Downloads/mag-starter";
let fail = 0;
const check = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " — " + x : ""}`); };

/* ---- statik: başlıklar veriden, bileşene gömülü değil ---- */
const tr = JSON.parse(readFileSync(path.join(root, "messages/tr.json"), "utf8"));
const en = JSON.parse(readFileSync(path.join(root, "messages/en.json"), "utf8"));
const TR_TITLES = ["DOKU", "KARAKTER", "KATMAN", "DENGE"];
const EN_TITLES = ["TEXTURE", "CHARACTER", "LAYERS", "BALANCE"];
check("TR başlıklar veride doğru", tr.claims.map((c) => c.l1).join(",") === TR_TITLES.join(","), tr.claims.map((c) => c.l1).join(", "));
check("EN başlıklar veride doğru", en.claims.map((c) => c.l1).join(",") === EN_TITLES.join(","), en.claims.map((c) => c.l1).join(", "));
check("EN tarafında AÇIK notu var", en.claims.every((c) => /AÇIK/.test(c._acik ?? "")));
const claimsSrc = readFileSync(path.join(root, "components/stage/Claims.tsx"), "utf8");
check("başlıklar bileşene gömülü değil", !TR_TITLES.some((t) => claimsSrc.includes(t)));
/* SSS verisi soru/cevap yapısında */
check("SSS verisi q/a yapısında", tr.faq.items.every((i) => typeof i.q === "string" && typeof i.a === "string"), `${tr.faq.items.length} soru`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.addInitScript(() => localStorage.setItem("mag:sound", "0"));
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForFunction(() => !document.querySelector(".pre"), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(900);

/* ---- SSS bölümüne kaydır ---- */
const S = segmentsFor(false);
const faqP = (S.faq[0] + S.faq[1]) / 2;
await p.evaluate((v) => { const m = document.documentElement.scrollHeight - innerHeight; scrollTo(0, Math.round(v * m)); }, mapP(faqP, false));
await p.waitForTimeout(1800);

const items = p.locator("[data-faq-item]");
const n = await items.count();
check("SSS soruları render edildi", n >= 3, `${n} soru`);

const state = (i) => p.evaluate((idx) => {
  const it = document.querySelectorAll("[data-faq-item]")[idx];
  const btn = it.querySelector("[data-faq-toggle]");
  const ans = it.querySelector("[data-faq-answer]");
  const r = ans.getBoundingClientRect();
  return {
    expanded: btn.getAttribute("aria-expanded"),
    controls: btn.getAttribute("aria-controls"),
    answerId: ans.id,
    height: Math.round(r.height),
    sign: getComputedStyle(it.querySelector(".faqsign")).transform,
    inert: ans.hasAttribute("inert"),
  };
}, i);

/* ---- tıklama: açılır ---- */
const before = await state(0);
check("başlangıçta kapalı (aria-expanded=false, yükseklik 0)", before.expanded === "false" && before.height === 0, `h=${before.height}`);
await items.nth(0).locator("[data-faq-toggle]").click();
await p.waitForTimeout(600);
const opened = await state(0);
check("tıklayınca açıldı", opened.expanded === "true" && opened.height > 20, `h=${opened.height}`);
check("cevap aria-controls ile bağlı", opened.controls === opened.answerId, `${opened.controls} = ${opened.answerId}`);
check("açıkken inert değil (ekran okuyucuya açık)", opened.inert === false);
check("işaret döndü (+ → ×)", opened.sign !== before.sign && opened.sign !== "none", opened.sign);

/* ---- ikinci soru: birden fazla açık kalabilir ---- */
await items.nth(1).locator("[data-faq-toggle]").click();
await p.waitForTimeout(600);
const first = await state(0), second = await state(1);
check("birden fazla soru aynı anda açık kalabilir", first.expanded === "true" && second.expanded === "true");

/* ---- tekrar tıklama: kapanır ---- */
await items.nth(0).locator("[data-faq-toggle]").click();
await p.waitForTimeout(600);
const closed = await state(0);
check("tekrar tıklayınca kapandı", closed.expanded === "false" && closed.height === 0, `h=${closed.height}`);
check("kapalıyken inert (odaklanamaz)", closed.inert === true);

/* ---- klavye: Tab + Enter + Space ---- */
await p.evaluate(() => document.querySelectorAll("[data-faq-toggle]")[2].focus());
const focused = await p.evaluate(() => document.activeElement?.getAttribute("data-faq-toggle") !== null);
check("soru düğmesi klavyeyle odaklanabilir", focused);
await p.keyboard.press("Enter");
await p.waitForTimeout(500);
check("Enter açtı", (await state(2)).expanded === "true");
await p.keyboard.press("Space");
await p.waitForTimeout(500);
check("Space kapattı", (await state(2)).expanded === "false");
/* Tab ile bir sonraki soruya geçebilmeli */
await p.keyboard.press("Tab");
const next = await p.evaluate(() => document.activeElement?.hasAttribute("data-faq-toggle") ?? false);
check("Tab ile sonraki soruya geçilir", next);

/* ---- scroll kurgusu bozulmadı: sahne hâlâ ilerliyor ---- */
const scenePos = await p.evaluate(() => ({ y: window.scrollY, faqOp: document.querySelector(".scFaq")?.style.opacity }));
check("SSS paneli görünür (scroll kurgusu korunuyor)", Number(scenePos.faqOp) > 0.5, `opacity=${scenePos.faqOp}`);

/* ---- iddia başlıkları sahnede ---- */
const mid = [S.c0, S.c1, S.c2, S.c3].map(([a, z]) => (a + z) / 2);
for (let i = 0; i < 4; i++) {
  await p.evaluate((v) => { const m = document.documentElement.scrollHeight - innerHeight; scrollTo(0, Math.round(v * m)); }, mapP(mid[i], false));
  await p.waitForTimeout(1700);
  const t = await p.evaluate(() => document.querySelector(".claimText .big")?.textContent?.trim().replace(/\s+/g, " ") ?? "");
  check(`c${i} başlığı "${TR_TITLES[i]}"`, t.toUpperCase().includes(TR_TITLES[i]), `"${t}"`);
}

await b.close();
console.log(fail ? `\n${fail} FAIL` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
