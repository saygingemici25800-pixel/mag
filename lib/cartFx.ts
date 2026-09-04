"use client";

/**
 * "Sepete ekle" animasyonu — Codrops "Add-to-Shopping Cart" (Andrea Biason) kurgusunun uyarlaması.
 *
 * gsap YALNIZCA burada, dinamik import ile yüklenir; böylece ana sayfa bundle'ına girmez
 * (bu modülü yalnızca /siparis ve /siparis/odeme bileşenleri çağırır).
 *
 * Kart üzerindeki "+ Ekle", sheet'teki "Sepete ekle" ve "şununla iyi gider" çipleri
 * aynı fonksiyonu (`flyToCart`) çağırır.
 */

/** uçan kopya sayısı */
const COPIES = 6;
/** kopya kenarı (mobilde küçülür) */
const COPY_PX = 88;
const COPY_PX_M = 64;
/** sepet çubuğu henüz görünmüyorsa önce onu getir */
const BAR_IN_MS = 200;

type GsapModule = typeof import("gsap");
let gsapPromise: Promise<GsapModule> | null = null;
/** gsap'ı bir kez, istendiğinde yükle */
function loadGsap(): Promise<GsapModule> {
  gsapPromise ??= import("gsap");
  return gsapPromise;
}

/** Sipariş rotalarına girer girmez arka planda hazırla: ilk tıklamada bekleme olmasın. */
export function prefetchCartFx() {
  if (typeof window === "undefined") return;
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(() => void loadGsap());
  else window.setTimeout(() => void loadGsap(), 300);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const sel = {
  bar: "[data-cartbar]",
  barIcon: "[data-cart-icon]",
  badge: "[data-cart-badge]",
  total: "[data-cart-total]",
  card: "[data-pcard]",
};

/** Aynı anda tek uçuş; süren varken gelen istekler kuyruğa alınır (dimleme tekrar etmez). */
let running = false;
const queue: (() => void)[] = [];

function done() {
  running = false;
  const next = queue.shift();
  if (next) next();
}

export interface FlyOptions {
  /** kopyaların çıkacağı görsel (kart görseli ya da sheet'teki büyük görsel) */
  source: HTMLElement;
  /** sepet verisini güncelleyen geri çağrı — start+.6'da çalışır */
  commit: () => void;
  /** sheet'ten ekleniyorsa: 150 ms sonra sheet'i kapat (kopyalar uçmaya devam eder) */
  closeSheet?: () => void;
}

/**
 * Zaman çizelgesi (start = 0):
 *  0.00  diğer kartlar soluklaşır (scale .96 / opacity .35, stagger .03)
 *  0.00  kaynak görselin 6 kopyası fixed olarak uçar (1.6 s, stagger sondan başa .04)
 *  0.50  kaynak kart hafif büyür (scale 1.04)
 *  0.60  sepet güncellenir; rozet elastic pop, ikon zıplar, tutar sayı geçişiyle değişir
 *  1.50  kartlar eski haline döner
 */
export async function flyToCart(opts: FlyOptions): Promise<void> {
  if (typeof window === "undefined") return;

  /* Reduced motion: uçuş yok — yalnızca rozet pop'u ve tutar güncellenir. */
  if (prefersReducedMotion()) {
    opts.commit();
    opts.closeSheet?.();
    const badge = document.querySelector<HTMLElement>(sel.badge);
    if (badge) {
      badge.animate([{ transform: "scale(0.6)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out" });
    }
    return;
  }

  if (running) {
    /* Süren animasyon varken ikinci tıklama: kuyruğa al (kopyalar yeniden oynar, dimleme tekrarlanmaz). */
    return new Promise((resolve) => {
      queue.push(() => void flyToCart(opts).then(resolve));
    });
  }
  running = true;

  const { gsap } = await loadGsap();

  /* Çubuk henüz görünmüyorsa (sepet boştu) önce onu 200 ms'de yukarı getir; hedef ölçümü
     ancak o zaman doğru olur. Sonra kurgu normal akışıyla baştan başlar. */
  let bar = document.querySelector<HTMLElement>(sel.bar);
  if (!bar) {
    /* Çubuğu getirmek için sepete yazmak gerekiyor: veri şimdi işlenir, zaman çizelgesinde
       tekrarlanmaz (commit yerine boş fonksiyon geçilir). Kaynak görsel bekleme sırasında
       (sheet kapanınca) kalkabileceği için şimdiden dondurulur. */
    const early = snapshot(opts.source);
    opts.commit();
    await new Promise((r) => window.setTimeout(r, BAR_IN_MS));
    bar = document.querySelector<HTMLElement>(sel.bar);
    if (!bar) {
      opts.closeSheet?.();
      done();
      return;
    }
    await runTimeline(gsap, { ...opts, commit: () => {} }, bar, early);
    done();
    return;
  }

  await runTimeline(gsap, opts, bar);
  done();
}

/** Kaynak görselin anlık kopyası: sheet kapansa bile kopyalar aynı görünümden uçar. */
interface SourceSnapshot {
  rect: DOMRect;
  node: HTMLElement;
}
function snapshot(source: HTMLElement): SourceSnapshot {
  return { rect: source.getBoundingClientRect(), node: source.cloneNode(true) as HTMLElement };
}

/** hedef: çubuktaki ikon merkezi — her seferinde yeniden ölçülür */
function targetCenter(bar: HTMLElement): { x: number; y: number } {
  const icon = bar.querySelector<HTMLElement>(sel.barIcon) ?? bar;
  const r = icon.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Kaynak görselin kopyalarını oluştur ve hedefe uçur.
 * `snap`: kaynak DOM'dan kalkmadan önce alınmış ölçü + klon (sheet kapanırken de uçabilsin).
 */
function flyCopies(gsap: GsapModule["gsap"], snap: SourceSnapshot, bar: HTMLElement): Promise<void> {
  const from = snap.rect;
  if (!from.width || !from.height) return Promise.resolve();
  const size = window.innerWidth < 640 ? COPY_PX_M : COPY_PX;
  const to = targetCenter(bar);

  /* Kopya, kaynak görselin tam üstünde başlar; transform-origin: bottom left. */
  const nodes: HTMLElement[] = [];
  for (let i = 0; i < COPIES; i++) {
    const el = document.createElement("div");
    el.className = "cartfx-copy";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      `position:fixed;left:${from.left}px;top:${from.top}px;width:${size}px;height:${size}px;` +
      `transform-origin:bottom left;z-index:80;pointer-events:none;`;
    /* kaynak görselin klonu (next/image <img> ya da tipografik kutu) */
    const inner = snap.node.cloneNode(true) as HTMLElement;
    inner.style.cssText = "width:100%;height:100%;margin:0;border-radius:12px;overflow:hidden;";
    el.appendChild(inner);
    document.body.appendChild(el);
    nodes.push(el);
  }

  /* %40'ta yukarı fırlar, %100'de sepet ikonuna iner. */
  const dx = to.x - from.left - size / 2;
  const dy = to.y - from.top - size / 2;
  return new Promise((resolve) => {
    gsap.to(nodes, {
      keyframes: [
        { x: dx * 0.15, y: -1.5 * from.height, scale: 0.55, opacity: 1, duration: 0.64 },
        { x: dx, y: dy, scale: 0, opacity: 0, duration: 0.96 },
      ],
      ease: "power2.inOut",
      stagger: { each: 0.04, from: "end" },
      onComplete: () => {
        nodes.forEach((n) => n.remove());
        resolve();
      },
    });
  });
}

/** rozet pop + ikon zıplaması */
function popBadge(gsap: GsapModule["gsap"]) {
  const badge = document.querySelector<HTMLElement>(sel.badge);
  const icon = document.querySelector<HTMLElement>(sel.barIcon);
  if (badge) gsap.fromTo(badge, { scale: 0 }, { scale: 1, duration: 0.8, ease: "elastic.out(1.3, 0.9)" });
  if (icon) gsap.fromTo(icon, { y: 0 }, { y: -12, duration: 0.25, ease: "back.out(2)", yoyo: true, repeat: 1 });
}

/** tutarı sayı geçişiyle güncelle (mono, tabular-nums) */
function tweenTotal(gsap: GsapModule["gsap"], from: number, to: number) {
  const el = document.querySelector<HTMLElement>(sel.total);
  if (!el || from === to) return;
  const box = { v: from };
  gsap.to(box, {
    v: to,
    duration: 0.5,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = el.dataset.prefix ? `${el.dataset.prefix}${Math.round(box.v)}` : String(Math.round(box.v));
    },
  });
}

async function runTimeline(gsap: GsapModule["gsap"], opts: FlyOptions, bar: HTMLElement, pre?: SourceSnapshot): Promise<void> {
  /* Kaynağı hemen dondur: sheet 150 ms sonra kapanınca görsel DOM'dan kalkıyor. */
  const snap = pre ?? snapshot(opts.source);
  const cards = Array.from(document.querySelectorAll<HTMLElement>(sel.card));
  const sourceCard = opts.source.closest<HTMLElement>(sel.card);
  const others = cards.filter((c) => c !== sourceCard);
  const totalEl = document.querySelector<HTMLElement>(sel.total);
  const totalBefore = Number(totalEl?.dataset.value ?? 0);

  const tl = gsap.timeline();
  /* 0.00 — diğer kartlar geri çekilir */
  if (others.length) {
    tl.to(others, { scale: 0.96, opacity: 0.35, duration: 0.5, stagger: 0.03, ease: "power2.out" }, 0);
  }
  /* 0.50 — tıklanan kart hafif öne çıkar */
  if (sourceCard) {
    tl.to(sourceCard, { scale: 1.04, duration: 0.8, ease: "power2.out" }, 0.5);
  }
  /* 0.60 — sepet verisi ve çubuk göstergeleri */
  tl.add(() => {
    opts.commit();
    /* commit React state'ini değiştirir; DOM'a yansıması bir kare sürer */
    requestAnimationFrame(() => {
      popBadge(gsap);
      const after = Number(document.querySelector<HTMLElement>(sel.total)?.dataset.value ?? totalBefore);
      tweenTotal(gsap, totalBefore, after);
    });
  }, 0.6);
  /* 1.50 — kartlar eski haline */
  if (others.length) tl.to(others, { scale: 1, opacity: 1, duration: 0.7, stagger: 0.03, ease: "power2.out" }, 1.5);
  if (sourceCard) tl.to(sourceCard, { scale: 1, duration: 0.7, ease: "power2.out" }, 1.5);

  /* Sheet'ten ekleniyorsa 150 ms sonra kapanır; kopyalar fixed olduğu için uçmaya devam eder. */
  if (opts.closeSheet) window.setTimeout(opts.closeSheet, 150);

  await Promise.all([flyCopies(gsap, snap, bar), tl.then()]);
}

/**
 * Ödeme sayfası sepet özeti girişi — Codrops'un cart drawer girişi.
 * Satırlar x:24 → 0 / opacity, stagger .08; toplam bloğu start+.25'te scale .94 → 1.
 */
export async function animateSummaryIn(root: HTMLElement) {
  if (prefersReducedMotion()) return;
  const { gsap } = await loadGsap();
  const lines = root.querySelectorAll<HTMLElement>("[data-cart-line]");
  const totalBlock = root.querySelector<HTMLElement>("[data-cart-totals]");
  const tl = gsap.timeline();
  if (lines.length) tl.fromTo(lines, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: "power2.out" }, 0);
  if (totalBlock) tl.fromTo(totalBlock, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "power2.out" }, 0.25);
}

/** Satır silme: x:24 + opacity 0 (0.4 s), sonra yüksekliği kapanır. */
export async function animateLineOut(line: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return;
  const { gsap } = await loadGsap();
  await gsap.to(line, { x: 24, opacity: 0, duration: 0.4, ease: "power2.out" }).then();
  await gsap.to(line, { height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, duration: 0.25, ease: "power2.out" }).then();
}
