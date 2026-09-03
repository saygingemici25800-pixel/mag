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
  discA: number;
  discB: { opacity: number; top: number; scale: number };
  arrows: { ax: number; ay: number; opacity: number };
  dots: number;
  floor: number;
  aura: number;
  hero: number;
  dive: number;
  /** aktif iddia (−1: ürün kopyası) */
  ci: number;
  pay: number;
  faq: number;
  foot: { ty: number; opacity: number };
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

    if (tDive > 0) {
      if (i === CENTER) {
        x = lerp(x, mobile ? 0 : vw * 0.2, diveE);
        y = lerp(y, vh * 0.46, diveE);
        sc = lerp(sc, mobile ? 1.95 : 2.25, diveE);
        rot = lerp(rot, -4, diveE);
        br = lerp(br, 1, diveE);
        bl = 0;
        op = 1;
      } else {
        x = lerp(x, x + (t < 0 ? -vw * 0.75 : vw * 0.75), diveE);
        op = lerp(op, 0, Math.min(diveE * 1.7, 1));
      }
    }
    if (i === CENTER && claimsT > 0) {
      y = lerp(vh * 0.46, vh * 0.44, claimsT);
      sc = lerp(mobile ? 1.95 : 2.25, mobile ? 2.1 : 2.45, claimsT);
      br = lerp(1, 0.34, Math.min(claimsT * 1.4, 1));
      rot = lerp(-4, -7, claimsT);
    }
    if (i === CENTER && tPay > 0) {
      x = lerp(mobile ? 0 : vw * 0.2, 0, payE);
      y = lerp(vh * 0.44, vh * 0.44, payE);
      sc = lerp(mobile ? 2.1 : 2.45, 1.3, payE);
      rot = lerp(-7, 0, payE);
      br = lerp(0.34, 1.05, Math.min(payE * 1.5, 1));
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
    if (i === CENTER) sc *= 1.14;

    if (outro) {
      /* p=1'deki kare, p=0'daki hero karesinin aynısı olmalı ki geçiş görünmesin */
      const hsc = (1 - a * 0.185) * (i === CENTER ? 1.14 : 1);
      const hx = t * spacing,
        hy = baseY + a * a * 13,
        hrot = t * 3.2;
      const hbr = 1 - a * 0.42,
        hbl = a > 1.6 ? (a - 1.6) * 1.4 : 0;
      if (i === CENTER) {
        /* faz 1 — BİZE KATIL yukarı süzülürken burger alttan, aynı eğriyle, büyüyerek ortaya */
        const eo = smooth(tOut1);
        sc = lerp(hsc * 0.3, hsc, eo);
        x = 0;
        y = lerp(vh * 0.8, hy, eo); // barın altından başlar
        rot = 0;
        br = lerp(0.55, hbr, eo);
        bl = lerp(3, hbl, eo);
        op = 1;
      } else {
        /* faz 2 — yanındakiler önce koyu siluet, sonra hero yerine */
        const lag = (a - 1) * 0.22; // dıştakiler biraz geç
        const st = clamp((tOut2 - lag) / (1 - lag));
        const e2 = ease(st);
        x = lerp(hx * 0.55, hx, e2); // ortadan dışarı açılır
        y = lerp(hy + vh * 0.03, hy, e2);
        sc = lerp(hsc * 0.82, hsc, e2);
        rot = lerp(0, hrot, e2);
        br = lerp(0.05, hbr, clamp((st - 0.35) / 0.65)); // siluet → dolu
        bl = lerp(7, hbl, e2);
        op = clamp(st * 3.2) * slotVisibility(a);
      }
    }
    const brc = Math.max(0.1, Math.min(1.2, br));
    /* yan slotlar soluk: saturate(1 − a·0.3); dive/claims/pay odaktaki için a=0 → 1 */
    const sat = Math.max(0.1, 1 - Math.min(a, 3) * 0.3);
    const satq = Math.round(sat * 20) / 20;
    /* blur: 0.5px adımlara yuvarla (her karede yeni filtre üretilmesin), 0.4 altını yazma */
    const blq = Math.round(Math.min(bl, 9) * 2) / 2;
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
  let discOut = 1 - Math.max(diveE, upT);
  if (tOut > 0) discOut = clamp((tOut1 - 0.72) / 0.28); // plint burger yere oturunca gelir
  const fanD = tOut > 0 ? 0 : fanE; // kapanışta yelpaze kapalı pozunda olmalı
  const ch = env.ch || defaultCutoutHeight(vh, vw);
  /* oklar: odaktaki burgerin iki yanında, dikeyde tam ortasında; mobilde her zaman ekran içinde */
  const cwid = (env.cw || 300) * 1.14;
  const ax = mobile ? Math.min(cwid / 2 + 22, vw / 2 - 30) : cwid / 2 + 44;
  const ay = baseY + ch * 0.57;
  const dots = tOut > 0 ? clamp((tOut2 - 0.5) / 0.5) * 0.75 : discOut * 0.75 * (1 - fanD);
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
  const faq = seg(p, S.faq[0], S.faq[0] + 0.03) * (1 - seg(p, S.faq[1] - 0.03, S.faq[1]));
  const footE = smooth(tOut1);
  const foot = {
    ty: -footE * vh * 0.78,
    opacity: seg(p, S.foot[0], S.foot[0] + 0.02) * (1 - clamp((footE - 0.58) / 0.3)),
  };

  let knob = 8 + p * 84;
  if (tOut > 0) knob = lerp(8 + S.out1[0] * 84, 8, ease(tOut));
  const track = tOut > 0 ? clamp((tOut2 - 0.3) / 0.5) : 1 - upT;
  const streak = tOut > 0 ? lerp(S.out1[0] * 86, 0, ease(tOut)) : p * 86;
  const hint = Math.max(heroOut, clamp((tOut2 - 0.65) / 0.35));
  const arrowsO = Math.max(heroOut, clamp((tOut2 - 0.55) / 0.4));

  return {
    bg,
    lm,
    items,
    discA: discOut * (1 - fanD * 0.55),
    discB: { opacity: discOut, top: baseY + ch * 1.09, scale: 1 - fanD * 0.12 },
    arrows: { ax, ay, opacity: arrowsO },
    dots,
    floor,
    aura,
    hero,
    dive,
    ci,
    pay,
    faq,
    foot,
    knob,
    track,
    streak,
    hint,
    rays,
    cta,
    grad,
  };
}

/** slot i → MENU[(active + i − CENTER) mod N] — hiçbir ürün iki kez görünmez */
export function slotIndex(active: number, i: number, n: number = N): number {
  return (((active + i - CENTER) % n) + n) % n;
}
