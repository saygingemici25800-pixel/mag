// "Sepete ekle" animasyonu: kart · sheet · çip ekleme, animasyon sırasında ikinci tıklama, reduced-motion.
// Her senaryoda 0.3 / 0.9 / 1.4 s'de ara kare alınır.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3112";
const out = process.argv[3] ?? "docs/screens/cartfx";
mkdirSync(out, { recursive: true });

const FRAMES = [300, 900, 1400];
const VIEWS = [
  { name: "1440", width: 1440, height: 860, copy: 88 },
  { name: "390", width: 390, height: 844, copy: 64 },
];
let fail = 0;
const check = (n, ok, x = "") => { console.log((ok ? "PASS" : "FAIL") + " " + n + (x ? " — " + x : "")); if (!ok) fail++; };

/**
 * Animasyonun belirli anlarındaki durumu örnekler.
 *
 * KARARSIZLIK DÜZELTMESİ (24 Eyl 2026): eskiden kareler `waitForTimeout(t-prev)`
 * ile sırayla bekleniyor ve HER karede ekran görüntüsü alınıyordu. Ekran
 * görüntüsü 200–600 ms sürüyor ve bu süre bir SONRAKİ karenin beklemesine
 * EKLENİYORDU: ölçüldü, "900 ms" karesi gerçekte 1535 ms'de, "1400 ms" karesi
 * 2717 ms'de düşüyordu. Uçuş 1.6 sn olduğu için kopyalar çoktan temizlenmiş
 * oluyor ve `kopya=0` ile testler düşüyordu — üründe hata yok, ölçüm kayıyordu.
 * Makine yükü arttıkça kayma büyüdüğü için sonuç koşudan koşuya değişiyordu.
 *
 * Artık: bekleme TIKLAMA ANINDAN itibaren gerçek saatle hesaplanıyor (kayma
 * birikmiyor) ve ekran görüntüleri ÖLÇÜMDEN SONRA alınıyor, yani ölçülen anı
 * etkilemiyor.
 */
const snap = async (p, tag) => {
  const shots = [];
  const t0 = Date.now();
  const bekle = [];
  for (const t of FRAMES) {
    const kalan = t - (Date.now() - t0);
    if (kalan > 0) await p.waitForTimeout(kalan);
    const st = await p.evaluate(() => ({
      copies: document.querySelectorAll(".cartfx-copy").length,
      bar: !!document.querySelector("[data-cartbar]"),
      badge: document.querySelector("[data-cart-badge]")?.textContent ?? null,
      total: document.querySelector("[data-cart-total]")?.textContent ?? null,
      dimmed: [...document.querySelectorAll("[data-pcard]")].filter(c => {
        const o = parseFloat(getComputedStyle(c).opacity); return o < 0.9;
      }).length,
    }));
    shots.push({ t, gercek: Date.now() - t0, ...st });
    /* Kare görüntüsü ölçümden SONRA ve sıradan BAĞIMSIZ: buffer'a alınır,
       diske yazma döngü bittikten sonra yapılır. */
    bekle.push(p.screenshot({ path: `${out}/${tag}-${t}ms.png` }).catch(() => {}));
  }
  await Promise.all(bekle);
  return shots;
};

const fresh = async (b, v, opts = {}) => {
  const p = await b.newPage({
    viewport: { width: v.width, height: v.height },
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
  });
  await p.addInitScript(() => { localStorage.setItem("mag:sound", "0"); localStorage.removeItem("mag:cart"); });
  await p.goto(base + "/siparis", { waitUntil: "load" });
  await p.waitForTimeout(900); // gsap idle prefetch
  return p;
};

const b = await chromium.launch();
for (const v of VIEWS) {
  // ---- 1) kart üzerinden ekleme
  {
    const p = await fresh(b, v);
    await p.locator(".addbtn").first().click();
    const s = await snap(p, `${v.name}-kart`);
    check(`${v.name} kart: 0.3 s'de kopyalar uçuyor`, s[0].copies === 6, `kopya=${s[0].copies}`);
    check(`${v.name} kart: 0.3 s'de diğer kartlar soluk`, s[0].dimmed > 0, `soluk=${s[0].dimmed}`);
    check(`${v.name} kart: 0.9 s'de kopyalar hâlâ yolda`, s[1].copies === 6, `kopya=${s[1].copies}`);
    check(`${v.name} kart: 0.9 s'de çubuk ve rozet var`, s[1].bar && s[1].badge === "1", `rozet=${s[1].badge}`);
    check(`${v.name} kart: 1.4 s'de kopyalar hâlâ uçuyor (süre 1.6 s)`, s[2].copies === 6, `kopya=${s[2].copies}`);
    await p.waitForTimeout(1100); // 1.6 s + stagger + boş sepette 200 ms çubuk bekleme
    check(`${v.name} kart: uçuş bitince kopyalar temizlenir`, await p.evaluate(() => document.querySelectorAll(".cartfx-copy").length) === 0);
    await p.waitForTimeout(1200);
    const restored = await p.evaluate(() => [...document.querySelectorAll("[data-pcard]")]
      .every(c => parseFloat(getComputedStyle(c).opacity) > 0.95));
    check(`${v.name} kart: kartlar eski haline döndü`, restored);
    await p.close();
  }

  // ---- 2) kopya boyutu
  {
    const p = await fresh(b, v);
    await p.locator(".addbtn").first().click();
    /* KARARSIZLIK DÜZELTMESİ (24 Eyl 2026): ölçüm `getBoundingClientRect()` ile
       yapılıyordu, ama kopyalar uçarken gsap onları ÖLÇEKLİYOR (scale .55 → 0).
       Rect ölçeklenmiş boyutu döndürdüğü için örnekleme anına göre 88 yerine 87,
       70, 53… okunuyordu. Kontrolün amacı OLUŞTURULAN kopyanın boyutu; o değer
       satır içi `width` stilinde sabit duruyor, ölçekten etkilenmiyor. */
    const kopya = await p.waitForSelector(".cartfx-copy", { timeout: 5000 }).catch(() => null);
    const size = kopya
      ? await p.evaluate(() => {
          const c = document.querySelector(".cartfx-copy");
          return c ? Math.round(parseFloat(c.style.width)) : null;
        })
      : null;
    check(`${v.name} kopya ${v.copy}px`, size === v.copy, `ölçülen=${size}`);
    await p.close();
  }

  // ---- 3) sheet'ten ekleme (sheet 150 ms sonra kapanır, kopyalar uçmaya devam)
  {
    const p = await fresh(b, v);
    await p.locator(".pcard").first().click();
    await p.waitForSelector(".sheet");
    await p.locator(".sheet .submit").click();
    const s = await snap(p, `${v.name}-sheet`);
    check(`${v.name} sheet: 0.3 s'de sheet kapandı`, await p.locator(".sheet").count() === 0);
    check(`${v.name} sheet: 0.3 s'de kopyalar uçuyor`, s[0].copies === 6, `kopya=${s[0].copies}`);
    check(`${v.name} sheet: 0.9 s'de kopyalar hâlâ yolda`, s[1].copies === 6, `kopya=${s[1].copies}`);
    check(`${v.name} sheet: 1.4 s'de hâlâ uçuyor, sepet dolu`, s[2].copies === 6 && s[2].bar, `kopya=${s[2].copies}`);
    await p.waitForTimeout(1100);
    check(`${v.name} sheet: uçuş bitince temizlenir`, await p.evaluate(() => document.querySelectorAll(".cartfx-copy").length) === 0);
    await p.close();
  }

  // ---- 4) "şununla iyi gider" çipi
  {
    const p = await fresh(b, v);
    await p.locator(".pcard").first().click();
    await p.waitForSelector(".sheet");
    const chip = p.locator(".sheet .chip").first();
    if (await chip.count()) {
      await chip.click();
      const s = await snap(p, `${v.name}-cip`);
      check(`${v.name} çip: kopyalar uçuyor`, s[0].copies === 6, `kopya=${s[0].copies}`);
      check(`${v.name} çip: sheet açık kalır`, await p.locator(".sheet").count() === 1);
      check(`${v.name} çip: sepete eklendi`, s[2].bar);
    } else check(`${v.name} çip: çip bulundu`, false, "pairs yok");
    await p.close();
  }

  // ---- 5) animasyon sürerken ikinci tıklama → kuyruk
  {
    const p = await fresh(b, v);
    const btn = p.locator(".addbtn").first();
    await btn.click();
    await p.waitForTimeout(400);
    await btn.click({ force: true }); // sürerken ikinci tıklama
    await snap(p, `${v.name}-kuyruk`);
    /* KARARSIZLIK DÜZELTMESİ (24 Eyl 2026): burada sabit `waitForTimeout(4200)`
       vardı. İki tıklama KUYRUĞA giriyor ve animasyonlar SIRAYLA koşuyor; tek
       animasyon ~2.4 sn (1.5'te geri dönüş + stagger), ikisi arka arkaya ~6 sn
       sürüyor. 4200 ms tam İKİNCİ animasyonun ortasına denk geliyordu: kartlar
       o an yeniden soluk (opacity .35) olduğu için "eski haline döndü" kontrolü
       düşüyordu — üründe hata yok, ölçüm erken. Ölçüldü: 500 ms aralıklarla
       min opaklık .35 → .92 → .35 → 1 (6 sn). Artık süre tahmin edilmiyor,
       kuyruğun BİTTİĞİ durum bekleniyor: kopya kalmamış + kartlar geri gelmiş. */
    /* Beklenen SON DURUM: iki ekleme de işlenmiş (rozet 2) VE kuyruk boşalmış
       (kopya yok, kartlar geri gelmiş). Yalnız "kopya yok + kartlar geri geldi"
       beklemek YETMİYOR: bu koşul iki animasyonun ARASINDA da bir an sağlanıyor
       ve ölçüm ikinci ekleme işlenmeden (rozet=1) çıkıyordu. Rozet koşulu
       sırayı garantiliyor. */
    await p
      .waitForFunction(
        () =>
          document.querySelector("[data-cart-badge]")?.textContent === "2" &&
          document.querySelectorAll(".cartfx-copy").length === 0 &&
          [...document.querySelectorAll("[data-pcard]")].every((c) => parseFloat(getComputedStyle(c).opacity) > 0.95),
        null,
        { timeout: 15000, polling: 100 },
      )
      .catch(() => {});
    const end = await p.evaluate(() => ({
      badge: document.querySelector("[data-cart-badge]")?.textContent,
      copies: document.querySelectorAll(".cartfx-copy").length,
      restored: [...document.querySelectorAll("[data-pcard]")].every(c => parseFloat(getComputedStyle(c).opacity) > 0.95),
    }));
    check(`${v.name} kuyruk: iki ekleme de işlendi`, end.badge === "2", `rozet=${end.badge}`);
    check(`${v.name} kuyruk: kopyalar temizlendi`, end.copies === 0, `kalan=${end.copies}`);
    check(`${v.name} kuyruk: kartlar eski haline döndü`, end.restored);
    await p.close();
  }

  // ---- 6) reduced-motion: kopya yok, rozet ve tutar güncellenir
  {
    const p = await fresh(b, v, { reduced: true });
    await p.locator(".addbtn").first().click();
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({
      copies: document.querySelectorAll(".cartfx-copy").length,
      badge: document.querySelector("[data-cart-badge]")?.textContent,
      total: document.querySelector("[data-cart-total]")?.textContent,
    }));
    await p.screenshot({ path: `${out}/${v.name}-reduced-300ms.png` });
    check(`${v.name} reduced: kopya yok`, st.copies === 0, `kopya=${st.copies}`);
    check(`${v.name} reduced: rozet güncellendi`, st.badge === "1", `rozet=${st.badge}`);
    check(`${v.name} reduced: tutar var`, !!st.total && st.total !== "₺0", `tutar=${st.total}`);
    await p.close();
  }

  // ---- 7) çubuk görünürken alt boşluk
  {
    const p = await fresh(b, v);
    await p.locator(".addbtn").first().click();
    await p.waitForTimeout(2600);
    const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ord-list")).paddingBottom));
    check(`${v.name} çubuk varken alt boşluk ≥96px`, pad >= 96, `padding=${pad}px`);
    await p.close();
  }
}

// ---- 8) ödeme sayfası: özet girişi + satır silme
for (const v of VIEWS) {
  const p = await b.newPage({ viewport: { width: v.width, height: v.height } });
  await p.addInitScript(() => {
    localStorage.setItem("mag:sound", "0");
    localStorage.setItem("mag:cart", JSON.stringify({ v: 1, lines: { smooky: { qty: 2, note: "" }, truffle: { qty: 1, note: "" } } }));
  });
  await p.goto(base + "/siparis/odeme", { waitUntil: "load" });
  /* KARARSIZLIK DÜZELTMESİ (24 Eyl 2026): burada sabit `waitForTimeout(120)`
     vardı ve animasyonu "tam o anda" yakalamaya çalışıyordu. Giriş animasyonunu
     (animateSummaryIn) gsap DİNAMİK import ile kuruyor; chunk geç gelirse
     animasyon 120 ms'de henüz BAŞLAMAMIŞ, erken gelirse 0.7 sn'lik animasyon
     bitmiş oluyordu. İki uçta da ölçüm {op:1, tf:"none"} okuyup testi
     düşürüyordu — üründe hata yokken (4/1/1 oynaklığın kaynağı buydu).
     Artık sabit süre beklenmiyor: animasyonun BAŞLADIĞI an yakalanıyor. */
  const early = await p
    .waitForFunction(() => {
      const l = [...document.querySelectorAll("[data-cart-line]")].find((e) => e.getClientRects().length);
      if (!l) return false;
      const cs = getComputedStyle(l);
      const op = parseFloat(cs.opacity);
      /* gsap x:24 → transform matrix; opacity 0 → 1 */
      return op < 1 || cs.transform !== "none" ? { op, tf: cs.transform } : false;
    }, null, { timeout: 5000, polling: 16 })
    .then((h) => h.jsonValue())
    .catch(() => null);
  check(`${v.name} ödeme: satırlar sağdan girer`, !!early && (early.op < 1 || early.tf !== "none"), JSON.stringify(early));
  await p.screenshot({ path: `${out}/${v.name}-odeme-giris.png` });
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => {
    const l = [...document.querySelectorAll("[data-cart-line]")].find((e) => e.getClientRects().length);
    return l ? parseFloat(getComputedStyle(l).opacity) : null;
  });
  check(`${v.name} ödeme: giriş tamamlanır`, after === 1, `opacity=${after}`);

  const vis = p.locator("[data-cart-line]:visible");
  const before = await vis.count();
  await vis.first().locator("button", { hasText: /Sil|Remove/i }).click();
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${out}/${v.name}-odeme-silme.png` });
  await p.waitForTimeout(900);
  const nowCount = await p.locator("[data-cart-line]:visible").count();
  check(`${v.name} ödeme: satır silindi`, nowCount === before - 1, `${before} → ${nowCount}`);
  await p.close();
}

await b.close();
console.log(fail ? `\n${fail} kontrol başarısız` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
