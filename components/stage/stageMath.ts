/**
 * Sahne matematiği — proto/proto.html `render()` fonksiyonunun birebir portu.
 * Saf fonksiyonlar: DOM yok. Stage.tsx her karede `computeFrame` çağırıp sonucu DOM'a yazar.
 */

export const S = {
  fan: [0.04, 0.16],
  dive: [0.16, 0.28],
  c0: [0.28, 0.38],
  c1: [0.38, 0.46],
  c2: [0.46, 0.54],
  c3: [0.54, 0.62],
  pay: [0.62, 0.72],
  range: [0.72, 0.8],
  faq: [0.8, 0.87],
  foot: [0.87, 0.905],
  out1: [0.905, 0.958], // tek burger yaklaşır
  out2: [0.958, 0.99], // yanlar belirir
} as const satisfies Record<string, readonly [number, number]>;

/** Odak büyütmesi: scale = base(t_eff) × (1 + FOCUS_ZOOM × max(0, 1 − |t_eff|)) — sürekli, slota bağlı değil */
export const FOCUS_ZOOM = 0.14;
export const N = 8; // menu.burger sırası — hepsi hero'da
export const CENTER = 3; // odaklanan slot; görünür slotlar t=-2..+2, |t|≥3 hazır bekler (opacity 0)
/** |t| 2→3 arasında görünürlük 1→0 */
export function slotVisibility(a: number): number {
  return clamp(3 - a);
}

export const SMOOTHING = 0.12; // cur += (target-cur)*0.12
export const LOOP_AT = 0.9985; // atEnd && cur > LOOP_AT → scrollTo(0)
export const HOLD_MS = 420; // hero pozunda bir an dursun
export const LOOP_COOLDOWN_MS = 500;

export const BASE = "#0C0A08";

export function clamp(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
export function seg(p: number, a: number, b: number): number {
  return clamp((p - a) / (b - a));
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
export function toRGB(c: string): [number, number, number] {
  if (c[0] === "#") {
    return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
  }
  const m = c.match(/-?\d+/g) ?? ["0", "0", "0"];
  return [+m[0], +m[1], +m[2]];
}
export function mix(a: string, b: string, t: number): string {
  const A = toRGB(a),
    B = toRGB(b);
  return (
    "rgb(" +
    Math.round(lerp(A[0], B[0], t)) +
    "," +
    Math.round(lerp(A[1], B[1], t)) +
    "," +
    Math.round(lerp(A[2], B[2], t)) +
    ")"
  );
}
export function tintc(c: string, t: number): string {
  return mix(c, "rgb(255,255,255)", t);
}

export interface ItemStyle {
  transform: string;
  opacity: string;
  filter: string;
  z: number;
}

/** "Patlamış burger" katman sırası: yukarıdan aşağıya */
export const LAYER_ORDER = ["ekmekUst", "sos", "peynir", "et", "ekmekAlt"] as const;
export type LayerKey = (typeof LAYER_ORDER)[number];
/** Hangi claim hangi katman(lar)ı vurgular — EKMEK iki yarıyı birlikte */
export const CLAIM_LAYERS: readonly LayerKey[][] = [["et"], ["ekmekUst", "ekmekAlt"], ["peynir"], ["sos"]];
/** Toplam açıklık: yığın yüksekliğinin ~%38'i (önce %55'ti — 1.0 ölçekte viewport'a sığmıyordu) */
export const EXPLODE_SPREAD = 0.38;

export interface ExplodeLayer {
  /** dikey kayma (px) — birleşikken 0 */
  ty: number;
  /** perspektif derinliği (px) — üst katmanlar öne */
  tz: number;
  scale: number;
  /**
   * Pasif katmanı karartma: `filter: brightness()` DEĞİL, opaklık.
   * Zemin neredeyse siyah olduğu için opacity .5 ile brightness .5 görsel olarak aynı,
   * ama filtre beş büyük saydam katmanı kompozitörden boya aşamasına düşürüyordu.
   */
  opacity: number;
  /** arkasındaki yerel ışığın opaklığı (0…0.5) */
  glow: number;
}
export interface ExplodeFrame {
  /** 0: kapalı (fotoğraf gibi) → 1: tam ayrılmış */
  open: number;
  /** kutuyu kendi yüksekliğinin yarısı kadar yukarı al (açıldıkça 0 → 0.5) */
  centerY: number;
  /** bölüm görünürlüğü — odaktaki ürünün opaklığıyla aynı */
  opacity: number;
  /** ürün fotoğrafının yerine geçen kutunun konumu */
  transform: string;
  layers: Record<LayerKey, ExplodeLayer>;
}

/** Ok geçişi: 480 ms, cubic-bezier(.22,1,.28,1) */
export const SLIDE_MS = 480;
export function slideEase(x: number): number {
  // cubic-bezier(.22,1,.28,1) — x için t'yi Newton ile çöz
  const p1x = 0.22,
    p1y = 1,
    p2x = 0.28,
    p2y = 1;
  const cx = 3 * p1x,
    bx = 3 * (p2x - p1x) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * p1y,
    by = 3 * (p2y - p1y) - cy,
    ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const err = sampleX(t) - x;
    const d = dX(t);
    if (Math.abs(err) < 1e-5 || d === 0) break;
    t -= err / d;
  }
  return sampleY(Math.max(0, Math.min(1, t)));
}

export interface Frame {
  bg: string;
  lm: boolean;
  items: ItemStyle[];
  arrows: { ax: number; ay: number; opacity: number; shift: number };
  dots: number;
  floor: number;
  aura: number;
  hero: number;
  dive: number;
  /** aktif iddia (−1: ürün kopyası) */
  ci: number;
  pay: number;
  /** SSS paneli — alttan gelen sayfa: panel/iç kapsayıcı kaydırma, üstüne binildikçe küçülüp kararma */
  faq: { opacity: number; ty: number; innerTy: number; scale: number; brightness: number };
  /** BİZE KATIL — SSS'nin üstüne biner; out1'de mevcut yukarı süzülme */
  foot: { ty: number; opacity: number; innerTy: number; bg: number };
  /** panellerin arkasındaki sahneye koyu perde (0→.45) */
  panelVeil: number;
  /** knob left % */
  knob: number;
  track: number;
  /** streak left % */
  streak: number;
  hint: number;
  /** ışık konisi (LightRays) opaklığı */
  rays: number;
  /** sağ alt "Sipariş ver" pill'i: dive'dan itibaren, kapanışta kaybolur */
  cta: number;
  /** ürün arka plan gradyanının gücü: hero 1 · yelpaze .7 · dalış/iddialar .35 · manifesto ve sonrası 0 · kapanış → 1 */
  grad: number;
  /** iddia bölümündeki "patlamış burger" (yalnızca dört katmanı tam olan üründe kullanılır) */
  explode: ExplodeFrame;
}

export interface Env {
  vw: number;
  vh: number;
  /** odaktaki ürünün aksan rengi */
  accent: string;
  /** odaktaki cutout img clientHeight (0 → varsayılan) */
  ch: number;
  /** odaktaki cutout img clientWidth (0 → varsayılan) */
  cw: number;
  /** slot başına [görselGenişliği, cx] — görsel ağırlık merkezi düzeltmesi (lib/cutCenters.json) */
  slots?: { w: number; cx: number }[];
}

export function heroSpacing(vw: number): number {
  return Math.min(vw * 0.28, 460); // komşular arası — iç içe geçmez, dıştakiler kenardan görünür
}
export function heroBaseY(vh: number): number {
  return vh * 0.4; // where the focus piece sits
}
export function defaultCutoutHeight(vh: number, vw: number = 1440): number {
  return vw < 900 ? Math.min(vh * 0.26, 190) : Math.min(vh * 0.33, 248);
}
/** Ok konumu için sabit referans genişlik — ürüne göre değişmez (cutout'un tipik en/boy oranı) */
export function defaultCutoutWidth(vh: number, vw: number = 1440): number {
  return defaultCutoutHeight(vh, vw) * 1.72;
}

export function claimIndex(p: number): number {
  if (p >= S.c0[0] && p < S.c1[0]) return 0;
  if (p >= S.c1[0] && p < S.c2[0]) return 1;
  if (p >= S.c2[0] && p < S.c3[0]) return 2;
  if (p >= S.c3[0] && p < S.pay[0]) return 3;
  return -1;
}

/**
 * @param offset ok geçişi: 0→±1 (t_eff = t − offset); bitince 0'a döner ve slotlar bir kaydırılır
 */
export function computeFrame(p: number, env: Env, offset = 0): Frame {
  const { vw, vh, accent } = env;
  const mobile = vw < 900;

  const tFan = seg(p, S.fan[0], S.fan[1]),
    tDive = seg(p, S.dive[0], S.dive[1]);
  const tPay = seg(p, S.pay[0], S.pay[1]),
    tRange = seg(p, S.range[0], S.range[1]);
  const fanE = ease(tFan),
    diveE = ease(tDive),
    payE = ease(tPay),
    rangeE = ease(tRange);
  const claimsT = seg(p, S.c0[0], S.c3[1]);
  let upT = seg(p, S.faq[0] - 0.03, S.faq[0] + 0.02);
  /* kapanış: burger uzaktan gelip tam hero pozuna oturur, sayfa oradan başa döner */
  const tOut1 = seg(p, S.out1[0], S.out1[1]); // odaktaki burger uzaktan gelir
  const tOut2 = seg(p, S.out2[0], S.out2[1]); // yanındakiler siluet olarak belirir
  const tOut = seg(p, S.out1[0], S.out2[1]); // tüm kapanış
  const outro = p >= S.foot[0]; // BİZE KATIL'dan itibaren burger barın altından görünür
  if (tOut > 0) upT = upT * (1 - ease(Math.min(tOut1 * 1.6, 1)));

  /* background */
  const bright = tintc(accent, 0.62);
  let bg = mix(BASE, accent, diveE * 0.05);
  if (tPay > 0) bg = mix(mix(BASE, accent, 0.05), bright, ease(Math.min(tPay / 0.42, 1)));
  if (tRange > 0) bg = mix(bright, BASE, ease(Math.min(tRange / 0.32, 1)));
  const lm = tPay > 0.32 && tRange < 0.3;

  /* the arc */
  const spacing = heroSpacing(vw);
  const baseY = heroBaseY(vh);
  const items: ItemStyle[] = [];
  /* odak slotunun son pozu — patlamış burger aynı yere oturur */
  let focusPose = { x: 0, y: vh * 0.44, sc: 1, rot: 0, op: 1, brc: 1 };
  for (let i = 0; i < N; i++) {
    const t = i - CENTER - offset; // t_eff
    const a = Math.abs(t);
    // hero / fan pose
    const closed = {
      x: t * spacing,
      y: baseY + a * a * 13,
      sc: 1 - a * 0.185,
      rot: t * 3.2,
      br: 1 - a * 0.42, // ışık yalnızca ortadakine: a=1 → .58, a=2 → .16
      bl: a > 1.6 ? (a - 1.6) * 1.4 : 0,
      op: 1,
    };
    const opened = {
      x: t * spacing * 1.16,
      y: baseY + a * a * 17,
      sc: 1 - a * 0.155,
      rot: t * 4.4,
      br: 1 - a * 0.27,
      bl: a > 2.2 ? (a - 2.2) * 1.9 : 0,
      op: 1,
    };
    let x = lerp(closed.x, opened.x, fanE),
      y = lerp(closed.y, opened.y, fanE);
    let sc = lerp(closed.sc, opened.sc, fanE),
      rot = lerp(closed.rot, opened.rot, fanE);
    let br = lerp(closed.br, opened.br, fanE),
      bl = lerp(closed.bl, opened.bl, fanE);
    let op = lerp(closed.op, opened.op, fanE) * slotVisibility(a);

    /* Odaklanma ağırlığı: |t_eff| 0→1 arası 1→0. Ok geçişinde slot sıçraması yok, süreklidir. */
    const focusW = Math.max(0, 1 - a);

    if (tDive > 0) {
      // odak pozu (w=1) ile kenara kaçış (w=0) arasında harmanla — geçiş ortasında iki poz karışır
      const fx = lerp(x, mobile ? 0 : vw * 0.2, diveE);
      const fy = lerp(y, vh * 0.46, diveE);
      const fsc = lerp(sc, mobile ? 1.95 : 2.25, diveE);
      const frot = lerp(rot, -4, diveE);
      const fbr = lerp(br, 1, diveE);
      const sx = lerp(x, x + (t < 0 ? -vw * 0.75 : vw * 0.75), diveE);
      const sop = lerp(op, 0, Math.min(diveE * 1.7, 1));
      x = lerp(sx, fx, focusW);
      y = lerp(y, fy, focusW);
      sc = lerp(sc, fsc, focusW);
      rot = lerp(rot, frot, focusW);
      br = lerp(br, fbr, focusW);
      bl = lerp(bl, 0, focusW);
      op = lerp(sop, 1, focusW);
    }
    if (focusW > 0 && claimsT > 0) {
      y = lerp(y, lerp(vh * 0.46, vh * 0.44, claimsT), focusW);
      sc = lerp(sc, lerp(mobile ? 1.95 : 2.25, mobile ? 2.1 : 2.45, claimsT), focusW);
      br = lerp(br, lerp(1, 0.34, Math.min(claimsT * 1.4, 1)), focusW);
      rot = lerp(rot, lerp(-4, -7, claimsT), focusW);
    }
    if (focusW > 0 && tPay > 0) {
      x = lerp(x, lerp(mobile ? 0 : vw * 0.2, 0, payE), focusW);
      y = lerp(y, vh * 0.44, focusW);
      sc = lerp(sc, lerp(mobile ? 2.1 : 2.45, 1.3, payE), focusW);
      rot = lerp(rot, lerp(-7, 0, payE), focusW);
      br = lerp(br, lerp(0.34, 1.05, Math.min(payE * 1.5, 1)), focusW);
    }
    if (tRange > 0) {
      const rsp = Math.min(vw * 0.135, 150);
      x = lerp(x, t * rsp, rangeE);
      y = lerp(y, vh * 0.42 + a * 8, rangeE);
      sc = lerp(sc, 0.72 - a * 0.02, rangeE);
      rot = lerp(rot, t * 4, rangeE);
      br = lerp(br, 1 - a * 0.12, rangeE);
      bl = lerp(bl, a > 2.6 ? (a - 2.6) * 1.4 : 0, rangeE);
      op = lerp(op, 1, rangeE);
    }

    y -= upT * vh * 0.55;
    /* Odak büyütmesi t_eff'e bağlı sürekli: yana kayarken aynı anda büyür/küçülür, sonda zıplama olmaz */
    sc *= 1 + FOCUS_ZOOM * focusW;

    if (outro) {
      /* p=1'deki kare, p=0'daki hero karesinin aynısı olmalı ki geçiş görünmesin */
      const hsc = (1 - a * 0.185) * (1 + FOCUS_ZOOM * focusW);
      const hx = t * spacing,
        hy = baseY + a * a * 13,
        hrot = t * 3.2;
      const hbr = 1 - a * 0.42,
        hbl = a > 1.6 ? (a - 1.6) * 1.4 : 0;
      /* faz 1 — odak: BİZE KATIL yukarı süzülürken burger alttan, aynı eğriyle, büyüyerek ortaya */
      const eo = smooth(tOut1);
      const cSc = lerp(hsc * 0.3, hsc, eo),
        cY = lerp(vh * 0.8, hy, eo),
        cBr = lerp(0.55, hbr, eo),
        cBl = lerp(3, hbl, eo);
      /* faz 2 — yanlar: önce koyu siluet, sonra hero yerine */
      const lag = Math.max(0, a - 1) * 0.22; // dıştakiler biraz geç
      const st = clamp((tOut2 - lag) / (1 - lag));
      const e2 = ease(st);
      const sX = lerp(hx * 0.55, hx, e2), // ortadan dışarı açılır
        sY = lerp(hy + vh * 0.03, hy, e2),
        sSc = lerp(hsc * 0.82, hsc, e2),
        sRot = lerp(0, hrot, e2),
        sBr = lerp(0.05, hbr, clamp((st - 0.35) / 0.65)), // siluet → dolu
        sBl = lerp(7, hbl, e2),
        sOp = clamp(st * 3.2) * slotVisibility(a);
      x = lerp(sX, 0, focusW);
      y = lerp(sY, cY, focusW);
      sc = lerp(sSc, cSc, focusW);
      rot = lerp(sRot, 0, focusW);
      br = lerp(sBr, cBr, focusW);
      bl = lerp(sBl, cBl, focusW);
      op = lerp(sOp, 1, focusW);
    }
    /* görsel ağırlık merkezi düzeltmesi: (0.5 − cx) × görselGenişliği × ölçek.
       Smooky gibi tek yana taşan cutout'lar kutu merkezine göre değil, göze göre ortalanır. */
    const slot = env.slots?.[i];
    if (slot && slot.w > 0) x += (0.5 - slot.cx) * slot.w * sc;

    const brc = Math.max(0.1, Math.min(1.2, br));
    /* yan slotlar soluk: saturate(1 − a·0.3); dive/claims/pay odaktaki için a=0 → 1 */
    const sat = Math.max(0.1, 1 - Math.min(a, 3) * 0.3);
    const satq = Math.round(sat * 20) / 20;
    /* blur: 0.5px adımlara yuvarla (her karede yeni filtre üretilmesin), 0.4 altını yazma */
    const blq = Math.round(Math.min(bl, 9) * 2) / 2;
    /* Patlamış burger, odaktaki fotoğrafın tam yerine oturur: aynı poz burada saklanır. */
    if (i === CENTER) {
      focusPose = { x, y, sc, rot, op, brc: Math.max(0.1, Math.min(1.2, br)) };
    }
    items.push({
      transform:
        "translate(-50%,0) translate(" +
        x.toFixed(1) +
        "px," +
        y.toFixed(1) +
        "px) scale(" +
        sc.toFixed(3) +
        ") rotate(" +
        rot.toFixed(2) +
        "deg)",
      opacity: Math.max(0, outro ? op : op * (1 - upT)).toFixed(3),
      filter: "brightness(" + brc.toFixed(3) + ")" + (satq < 0.99 ? " saturate(" + satq.toFixed(2) + ")" : "") + (bl >= 0.4 ? " blur(" + blq.toFixed(1) + "px)" : ""),
      z: Math.round(22 - Math.min(a, 4) * 2), // odak 22, yanlar 20/18/16…
    });
  }

  /* discs follow the focus piece, and leave once we dive */
  /* hero yerleşimi görünürlüğü (noktalar) — diskler kaldırıldı, eğri korunuyor */
  let heroChrome = 1 - Math.max(diveE, upT);
  if (tOut > 0) heroChrome = clamp((tOut1 - 0.72) / 0.28);
  const fanD = tOut > 0 ? 0 : fanE; // kapanışta yelpaze kapalı pozunda olmalı
  /* Oklar sahnenin SABİT merkezine göre konumlanır; ürünün cutout genişliğine ya da
     görsel ağırlık merkezine (cutCenters) bağlanmaz. Aksi hâlde her üründe farklı yerde
     duruyordu (ölçüm: yatayda 37 px, dikeyde 25 px kayma). */
  const refW = defaultCutoutWidth(vh, vw) * (1 + FOCUS_ZOOM);
  const ax = mobile ? Math.min(refW / 2 + 22, vw / 2 - 30) : refW / 2 + 44;
  const axShift = 0;
  const ay = heroBaseY(vh) + defaultCutoutHeight(vh, vw) * 0.57;
  const dots = tOut > 0 ? clamp((tOut2 - 0.5) / 0.5) * 0.75 : heroChrome * 0.75 * (1 - fanD);
  const floor = tOut > 0 ? clamp(tOut1 * 1.5) : 1 - Math.max(payE * 0.9, upT);
  const aura = tOut > 0 ? clamp((tOut1 - 0.1) / 0.55) : Math.max(0, (1 - fanE * 0.72) * (1 - Math.max(payE, upT)));
  const rays =
    tOut > 0 ? clamp((tOut1 - 0.25) / 0.6) * 0.9 : Math.max(0, (1 - fanE * 0.55) * (1 - Math.max(diveE * 0.85, payE, upT)));
  const cta = seg(p, S.dive[0] + 0.01, S.dive[0] + 0.05) * (1 - seg(p, S.foot[0], S.foot[0] + 0.03));
  let grad = lerp(1, 0.7, fanE);
  if (tDive > 0) grad = lerp(0.7, 0.35, diveE);
  if (tPay > 0) grad = lerp(0.35, 0, ease(Math.min(tPay / 0.42, 1)));
  if (tOut > 0) grad = ease(tOut); // p=1 ≡ p=0

  /* copy */
  const heroOut = 1 - seg(p, 0.015, 0.075);
  const hero = Math.max(heroOut, clamp((tOut2 - 0.55) / 0.4));
  const dive = seg(p, 0.195, 0.245) * (1 - seg(p, S.pay[0] - 0.015, S.pay[0] + 0.012));
  const ci = claimIndex(p);
  const pay = seg(p, S.pay[0] + 0.02, S.pay[0] + 0.055) * (1 - seg(p, S.pay[1] - 0.05, S.pay[1]));
  /* --- "reveal": paneller alttan gelen sayfalar gibi binişir (stacked pages) --- */
  const tFaqSlide = seg(p, S.faq[0] - 0.035, S.faq[0] + 0.035);
  const tFootSlide = seg(p, S.foot[0] - 0.035, S.foot[0] + 0.035);
  const faqIn = ease(tFaqSlide);
  const footIn = ease(tFootSlide);
  /* SSS: panel alttan yukarı; içerik panelden geç gelir (parallax) */
  /* SSS'nin ÇIKIŞI: kapanışta (out1) panel sahneden çekilmeli, yoksa yükselen burgerin
     üstünde opak kalıyor ve döngü "geri SSS'ye attı" gibi görünüyor. Reveal yazılırken
     giriş korunmuş ama çıkış düşmüştü. */
  const faqOut = clamp(tOut1 / 0.42);
  const faq = {
    opacity: tFaqSlide > 0 ? 1 - faqOut : 0, // giriş konumla, çıkış kapanışta soluklaşarak
    ty: (1 - faqIn) * vh - faqOut * vh * 0.5, // foot ile birlikte yukarı süzül
    innerTy: -35 * (1 - tFaqSlide), // yüzde
    // BİZE KATIL üstüne binince altta kalır: hafifçe küçül ve karar
    scale: lerp(1, 0.96, footIn),
    brightness: lerp(1, 0.6, footIn),
  };
  const footE = smooth(tOut1);
  const foot = {
    ty: (1 - footIn) * vh - footE * vh * 0.78, // giriş: alttan; çıkış: mevcut yukarı süzülme
    opacity: tFootSlide > 0 ? 1 - clamp((footE - 0.58) / 0.3) : 0,
    innerTy: -35 * (1 - tFootSlide),
    // giriş boyunca opak; kapanış başlayınca (out1) burger arkadan görünsün diye saydamlaşır
    bg: 1 - clamp(tOut1 / 0.35),
  };
  /* arkadaki sahneye koyu perde: paneller bindikçe 0 → .45 */
  const panelVeil = Math.max(faqIn, footIn) * 0.45;

  let knob = 8 + p * 84;
  if (tOut > 0) knob = lerp(8 + S.out1[0] * 84, 8, ease(tOut));
  const track = tOut > 0 ? clamp((tOut2 - 0.3) / 0.5) : 1 - upT;
  const streak = tOut > 0 ? lerp(S.out1[0] * 86, 0, ease(tOut)) : p * 86;
  const hint = Math.max(heroOut, clamp((tOut2 - 0.65) / 0.35));
  const arrowsO = Math.max(heroOut, clamp((tOut2 - 0.55) / 0.4));

  /* ---- patlamış burger ----
     Açılma c0'ın başında (segment haritası değişmeden: [.28,.62]); manifestoya geçerken
     (c3 bitimi) aynı hareket tersine çalışıp burger birleşir. */
  const OPEN_IN = 0.035; // c0 başında açılma payı
  const openIn = seg(p, S.c0[0] - OPEN_IN, S.c0[0] + OPEN_IN);
  const openOut = seg(p, S.c3[1] - OPEN_IN, S.c3[1] + OPEN_IN);
  /* Kapanışta (foot/out1/out2) HER ZAMAN ürün fotoğrafı kullanılır, katmanlar değil:
     burger hero pozuna otururken ve yanlar belirirken sahnede tek düzlem olsun. */
  const open = outro ? 0 : ease(openIn) * (1 - ease(openOut));

  /* Katmanlar eşit aralıkla ayrılır; toplam açıklık yığın yüksekliğinin %55'i.
     Kayma değerleri kutunun KENDİ koordinatında yazılır; kutuya zaten scale uygulandığı için
     burada ölçekle çarpma (yoksa açıklık ~2.6 kat büyür ve katmanlar ekrandan taşar). */
  const stackH = env.ch || vh * 0.2;
  const gap = (stackH * EXPLODE_SPREAD) / (LAYER_ORDER.length - 1);
  const mid = (LAYER_ORDER.length - 1) / 2;

  const layers = {} as Record<LayerKey, ExplodeLayer>;
  const activeSet = ci >= 0 && ci < CLAIM_LAYERS.length ? CLAIM_LAYERS[ci] : [];
  /* Ayrılma/birleşme dışında katmanların pozisyonu sabit olmalı: `open` ve `gap` kayan
     noktada sürüklendiği için her karede yeni transform yazılıyordu (120 karede 147 yazım).
     `open`'ı 0.02 adımlara ve sonuçları tam piksele yuvarla; ayrılma bitince (open=1)
     değerler birebir aynı kalır ve `st()` yazımı atlar. Blur kuantalamasının aynısı. */
  const openQ = Math.round(open * 50) / 50;
  LAYER_ORDER.forEach((k, i) => {
    const isActive = activeSet.includes(k);
    /* i=0 en üst katman: yukarı çıkar (negatif ty), en alt aşağı iner */
    const ty = Math.round((i - mid) * gap * openQ);
    /* hafif perspektif: üst katmanlar biraz öne — tam profil değil, hero açısına yakın */
    const tz = Math.round((mid - i) * 12 * openQ);
    /* Vurgu değerleri KADEMELİ: her karede yeni filter/opacity yazmak beş büyük saydam
       görselin yeniden rasterize edilmesine yol açıyordu (masaüstünde ~17→38 ms). Bunlar
       yalnızca "açık mı" ve "aktif mi" durumuna bağlı; aradaki yumuşatmayı CSS 420 ms'lik
       geçişle yapar. Böylece kare başına yalnızca transform değişir (compositor'da kalır). */
    const opened = open > 0.5;
    layers[k] = {
      ty,
      tz: tz + (isActive && opened ? 18 : 0),
      scale: isActive && opened ? 1.04 : 1,
      /* pasif katman: opacity .5 (brightness .5 ile aynı görünür, filtre maliyeti yok) */
      opacity: !opened || isActive ? 1 : 0.5,
      /* aktifin "1.08 parlaklığı" filtreyle değil, accent gradyanını biraz güçlendirerek */
      glow: isActive && opened ? 0.5 : 0,
    };
  });

  /* Ayrılan yığın, tek fotoğraftan daha uzun: açıldıkça ölçeği kıs ve dikeyde ortala ki
     ekmek yarıları görüş alanının dışına taşmasın. Kapalıyken (open=0) fotoğrafla birebir aynı. */
  /* Ayrık yığının gerçek yüksekliği: katman kutusu + toplam açıklık, ölçekle çarpılmış.
     Mobilde genişlik de sınırlayıcı: dar ekranda ekmek yarıları yanlardan taşmasın. */
  /* Ayrık yığın tek fotoğraftan çok daha uzun; açıldıkça ölçeği kıs ki ekrana sığsın.
     (Kompozit maliyeti `contain` ile çözüldü, ölçekle değil — bkz. stage.css `.explode`.) */
  /* Ayrık yığın tek fotoğraftan uzun; açıldıkça ölçeği kıs ki ekrana sığsın.
     Açıklık %55 → %38'e indikten sonra 0.8 rahat sığıyor (1440'ta üstte 106, altta 123 px
     boşluk) ve gerçek Chrome'da kare süresi hero ile aynı. 0.9 da sığıyor ama kenar payı
     65 px'e düşüyor; 0.8 farklı içerik boylarına karşı daha güvenli. */
  const fitSc = focusPose.sc * lerp(1, mobile ? 0.5 : 0.8, open);
  /* Katmanlar kutu merkezinden ±(spread/2) kadar açılır; kutunun kendisi üstten hizalı.
     Görünür yığının merkezi = kutu üstü + kutuYüksekliği/2. Onu ekran ortasına getir. */
  /* Dikey ortalama JS'te değil CSS'te: kutuya `translateY(-50%)` uygulanır (aşağıda .explode
     açıkken `--exCenter`). Burada yalnızca kutunun referans noktasını ekran ortasına taşırız;
     kutu yüksekliği ölçekle değiştiği için piksel hesabı yapmak kırılgandı. */
  const cy = lerp(focusPose.y, vh * 0.5, open);
  const cx = lerp(focusPose.x, mobile ? 0 : vw * 0.16, open);

  const explode: ExplodeFrame = {
    open,
    centerY: 0.5 * open,
    opacity: focusPose.op,
    transform:
      "translate(-50%," +
      (-100 * (0.5 * open)).toFixed(1) +
      "%) translate(" +
      cx.toFixed(1) +
      "px," +
      cy.toFixed(1) +
      "px) scale(" +
      fitSc.toFixed(3) +
      ") rotate(" +
      lerp(focusPose.rot, 0, open).toFixed(2) +
      "deg)",
    layers,
  };

  return {
    bg,
    lm,
    items,
    arrows: { ax, ay, opacity: arrowsO, shift: axShift },
    dots,
    floor,
    aura,
    hero,
    dive,
    ci,
    pay,
    faq,
    foot,
    panelVeil,
    knob,
    track,
    streak,
    hint,
    rays,
    cta,
    grad,
    explode,
  };
}

/** slot i → MENU[(active + i − CENTER) mod N] — hiçbir ürün iki kez görünmez */
export function slotIndex(active: number, i: number, n: number = N): number {
  return (((active + i - CENTER) % n) + n) % n;
}
