/**
 * Sahne matematiği — proto/proto.html `render()` fonksiyonunun birebir portu.
 * Saf fonksiyonlar: DOM yok. Stage.tsx her karede `computeFrame` çağırıp sonucu DOM'a yazar.
 */

/** Masaüstü segment haritası — DEĞİŞMEZ. Mobil harita bundan türetilir (aşağıda). */
export const S_DESKTOP = {
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
type SegMap = { -readonly [K in keyof typeof S_DESKTOP]: readonly [number, number] };

/* Mobilde üç bölüm gereğinden uzundu: hero→iddia geçişi (fan+dive), iddia (c0..c3) ve manifesto
   (pay). Bu bölümlerin SCROLL uzunluğu (px) üçte bir kısalır; diğer bölümlerin px uzunluğu
   korunur. Sıra ve oranlar aynı, hiçbir aşama atlanmaz. Scroller yüksekliği de aynı oranda
   kısalır: 1200vh × MOBILE_TOTAL (stage.css'teki mobil değer bununla eşleşmeli). */
const MOBILE_SHRINK: Partial<Record<keyof typeof S_DESKTOP, number>> = { fan: 2 / 3, dive: 2 / 3, c0: 2 / 3, c1: 2 / 3, c2: 2 / 3, c3: 2 / 3, pay: 2 / 3 };
function buildMobile(): { map: SegMap; total: number } {
  const keys = Object.keys(S_DESKTOP) as (keyof typeof S_DESKTOP)[];
  const head = S_DESKTOP.fan[0]; // hero
  const tail = 1 - S_DESKTOP.out2[1];
  const lens = keys.map((k) => (S_DESKTOP[k][1] - S_DESKTOP[k][0]) * (MOBILE_SHRINK[k] ?? 1));
  const total = head + lens.reduce((a, b) => a + b, 0) + tail;
  const map = {} as SegMap;
  let at = head / total;
  keys.forEach((k, i) => {
    const len = lens[i] / total;
    map[k] = [+at.toFixed(5), +(at + len).toFixed(5)];
    at += len;
  });
  return { map, total: +total.toFixed(5) };
}
const MOBILE = buildMobile();
export const S_MOBILE: SegMap = MOBILE.map;
/** mobil scroller yüksekliği / masaüstü (1200vh × bu) */
export const MOBILE_TOTAL = MOBILE.total;
export function segmentsFor(mobile: boolean): SegMap {
  return mobile ? S_MOBILE : S_DESKTOP;
}
/** dış referanslar için masaüstü haritası */
export const S = S_DESKTOP;

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
  /** dikey kayma (kutu-yerel px) — birleşikken 0; TEK DÜZLEM: başka dönüşüm yok */
  ty: number;
  /** karanlık taban .35, aktif katman 1 (filtre değil, opaklık) */
  opacity: number;
}
export interface ExplodeLight {
  /** ışık merkezinin kare merkezinden dikey uzaklığı (kutu-yerel px) */
  ty: number;
  /** kare kenarına göre ölçek: genişlik ~1.3×, yükseklik ~.85× aktif katman */
  sx: number;
  sy: number;
  /** en fazla .5 */
  opacity: number;
}
export interface ExplodeFrame {
  /** yığın bu karede çiziliyor mu (fotoğraf o zaman display:none — ikisi aynı anda asla) */
  shown: boolean;
  /** aralık 0 (birleşik) → 1 (tam açık) */
  gap: number;
  /** yığın kutusunun konumu: fotoğrafla aynı kutu, aynı transform (döndürme 0) */
  transform: string;
  /** fotoğrafın takas öncesi/sonrası sönüklüğü (1 → .35 → 1) */
  photoDim: number;
  layers: Record<LayerKey, ExplodeLayer>;
  light: ExplodeLight;
}

/** Yığının fotoğraf kutusu içindeki yerleşimi (kutu-yerel, ölçeksiz px) — Explode.stackGeometry */
export interface StackGeo {
  /** kare kenarı */
  S: number;
  /** kare merkezi = fotoğraf gövdesinin merkezi */
  cx: number;
  cy: number;
  /** ekmeğin (bütün) içerik aralığı, kare üstünden */
  bunY0: number;
  bunY1: number;
  /** katman başına içerik genişliği ve dikey aralığı (kare üstünden) */
  layers: Record<LayerKey, { w: number; y0: number; y1: number }>;
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
  /** aydınlık bölüm perdesi (limon) gücü: manifestoda 0→1, çıkışta 1→0 */
  bright: number;
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
  /** ışık konisinin çıkış noktası (vh oranı): hero'daki burger gövdesinin üst kenarının %25 üstü */
  raysOriginY: number;
  /** iddia bölümündeki "patlamış burger" (yalnızca dört katmanı tam olan üründe kullanılır) */
  explode: ExplodeFrame;
}

export interface Env {
  vw: number;
  vh: number;
  /** odaktaki cutout img clientHeight (0 → varsayılan) */
  ch: number;
  /** odaktaki cutout img clientWidth (0 → varsayılan) */
  cw: number;
  /** slot başına [görselGenişliği, cx] — görsel ağırlık merkezi düzeltmesi (lib/cutCenters.json) */
  slots?: { w: number; cx: number }[];
  /** odaktaki ürünün dört katmanı da var → iddia bölümünde fotoğraf yerine yığın */
  layered?: boolean;
  /** yığın yerleşimi (layered iken) */
  stack?: StackGeo | null;
  /** odaktaki cutout'un gövde kutusu (dikey, 0..1) — ışık kaynağının konumu için */
  photoBody?: { y0: number; y1: number } | null;
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

export function claimIndex(p: number, mobile = false): number {
  const S = segmentsFor(mobile);
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
  const { vw, vh } = env;
  const mobile = vw < 900;
  /* segment haritası viewport'a göre (mobilde üç bölüm kısa); bantlar px cinsinden korunsun diye
     mobilde p-bantları segment uzunluk oranıyla ölçeklenir */
  const S = segmentsFor(mobile);
  const bandK = mobile ? 1 / MOBILE_TOTAL : 1;
  const cK = (S.c0[1] - S.c0[0]) / (S_DESKTOP.c0[1] - S_DESKTOP.c0[0]);
  /* iddia/dalış pozunda burgerin dikey hedefi: mobilde metin bloğu (alt %35) ile çakışmasın diye yukarıda */
  const claimY = mobile ? vh * 0.3 : vh * 0.46;

  const tFan = seg(p, S.fan[0], S.fan[1]),
    tDive = seg(p, S.dive[0], S.dive[1]);
  const tPay = seg(p, S.pay[0], S.pay[1]),
    tRange = seg(p, S.range[0], S.range[1]);
  const fanE = ease(tFan),
    diveE = ease(tDive),
    payE = ease(tPay),
    rangeE = ease(tRange);
  const claimsT = seg(p, S.c0[0], S.c3[1]);
  let upT = seg(p, S.faq[0] - 0.03 * bandK, S.faq[0] + 0.02 * bandK);
  /* kapanış: burger uzaktan gelip tam hero pozuna oturur, sayfa oradan başa döner */
  const tOut1 = seg(p, S.out1[0], S.out1[1]); // odaktaki burger uzaktan gelir
  const tOut2 = seg(p, S.out2[0], S.out2[1]); // yanındakiler siluet olarak belirir
  const tOut = seg(p, S.out1[0], S.out2[1]); // tüm kapanış
  const outro = p >= S.foot[0]; // BİZE KATIL'dan itibaren burger barın altından görünür

  /* ---- patlamış burger: takas noktaları ----
     Fotoğraf → yığın takası c0 başladıktan biraz sonra (P_IN), yığın → fotoğraf c3 bitmeden
     biraz önce (P_OUT). Takas TEK KAREDE, yığın birleşikken yapılır; aralık takastan sonra
     açılır, kapanırken önce kapanır. [c0[0], P_IN] bandında fotoğraf .35'e söner ve döndürmesi
     sıfırlanır ki takasın iki yanı da aynı boyda, karanlık, düz bir burger olsun. */
  const layered = Boolean(env.layered && env.stack) && !outro;
  const P_IN = S.c0[0] + 0.02 * cK;
  const P_OUT = S.c3[1] - 0.02 * cK;
  const BAND = 0.045 * cK;
  const tIn = seg(p, S.c0[0], P_IN);
  const tOpen = seg(p, P_IN, P_IN + BAND);
  const tClose = seg(p, P_OUT - BAND, P_OUT);
  const tRelit = seg(p, P_OUT, S.c3[1]);
  const stackShown = layered && p >= P_IN && p < P_OUT;
  const photoDim = layered ? (p < P_IN ? lerp(1, 0.35, tIn) : lerp(0.35, 1, tRelit)) : 1;
  if (tOut > 0) upT = upT * (1 - ease(Math.min(tOut1 * 1.6, 1)));

  /* background */
  /* limon perde: manifestoya girerken 0→1, çıkarken 1→0 (renk CSS'te, burada yalnızca güç) */
  let bright = tPay > 0 ? ease(Math.min(tPay / 0.42, 1)) : 0;
  if (tRange > 0) bright = 1 - ease(Math.min(tRange / 0.32, 1));
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
      const fy = lerp(y, claimY, diveE);
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
      if (layered) {
        /* Takas pozu: dalışın bitiş pozu DONDURULUR (y, ölçek, parlaklık sabit) — yığın bu kutuya
           oturur ve iddialar boyunca kutu hiç kımıldamaz. Yalnızca döndürme takasa kadar 0'a iner
           (tek düzlem). Sönme filtreyle değil opaklıkla (photoDim). */
        y = lerp(y, claimY, focusW);
        sc = lerp(sc, mobile ? 1.95 : 2.25, focusW);
        br = lerp(br, 1, focusW);
        rot = lerp(rot, lerp(-4, 0, tIn), focusW);
      } else {
        y = lerp(y, lerp(claimY, claimY - vh * 0.02, claimsT), focusW);
        sc = lerp(sc, lerp(mobile ? 1.95 : 2.25, mobile ? 2.1 : 2.45, claimsT), focusW);
        br = lerp(br, lerp(1, 0.34, Math.min(claimsT * 1.4, 1)), focusW);
        rot = lerp(rot, lerp(-4, -7, claimsT), focusW);
      }
    }
    if (focusW > 0 && tPay > 0) {
      /* manifestoya giriş, iddiaların bitiş pozundan başlar: layered'da dondurulmuş takas pozu */
      const fy = layered ? claimY : claimY - vh * 0.02;
      const fsc = layered ? (mobile ? 1.95 : 2.25) : mobile ? 2.1 : 2.45;
      const frot = layered ? 0 : -7;
      const fbr = layered ? 1 : 0.34;
      x = lerp(x, lerp(mobile ? 0 : vw * 0.2, 0, payE), focusW);
      y = lerp(y, lerp(fy, vh * 0.44, payE), focusW);
      sc = lerp(sc, lerp(fsc, 1.3, payE), focusW);
      rot = lerp(rot, lerp(frot, 0, payE), focusW);
      br = lerp(br, lerp(fbr, 1.05, Math.min(payE * 1.5, 1)), focusW);
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
      /* takas bantlarında fotoğraf .35'e söner (yığının karanlık taban durumuyla aynı) */
      op *= photoDim;
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
  /* Kapanışta ışık bir anda açılmasın: opaklık burgerin yükselme ilerlemesine (riseE = smooth(tOut1),
     kutu math'iyle aynı) bağlı, riseE^1.8 eğrisiyle 0'dan tam değere. Burger oturduğunda (riseE=1)
     ışık da tam — daha erken değil. */
  const riseE = smooth(tOut1);
  const lightIn = Math.pow(riseE, 1.8);
  const aura = tOut > 0 ? lightIn : Math.max(0, (1 - fanE * 0.72) * (1 - Math.max(payE, upT)));
  const rays = tOut > 0 ? lightIn * 0.9 : Math.max(0, (1 - fanE * 0.55) * (1 - Math.max(diveE * 0.85, payE, upT)));
  const cta = seg(p, S.dive[0] + 0.01, S.dive[0] + 0.05) * (1 - seg(p, S.foot[0], S.foot[0] + 0.03));

  /* copy */
  const heroOut = 1 - seg(p, 0.015, 0.075);
  const hero = Math.max(heroOut, clamp((tOut2 - 0.55) / 0.4));
  const dive = seg(p, 0.195, 0.245) * (1 - seg(p, S.pay[0] - 0.015, S.pay[0] + 0.012));
  const ci = claimIndex(p, mobile);
  const pay = seg(p, S.pay[0] + 0.02, S.pay[0] + 0.055) * (1 - seg(p, S.pay[1] - 0.05, S.pay[1]));
  /* --- "reveal": paneller alttan gelen sayfalar gibi binişir (stacked pages) --- */
  const tFaqSlide = seg(p, S.faq[0] - 0.035 * bandK, S.faq[0] + 0.035 * bandK);
  const tFootSlide = seg(p, S.foot[0] - 0.035 * bandK, S.foot[0] + 0.035 * bandK);
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

  /* ---- patlamış burger: aralık, ışık, kutu ----
     Kutu = fotoğrafın kutusu (aynı ölçü, aynı transform, döndürme 0). Yığın karesi bu kutunun
     içinde fotoğraf gövdesine oturur (Explode.stackGeometry). Katmanlar TEK DÜZLEMDE yalnızca
     dikey kayar; aralık, viewport'taki gerçek boşluktan hesaplanır ve hiçbir katman taşmaz. */
  const stack = env.stack;
  const cw = env.cw || 300;
  const ch = env.ch || defaultCutoutHeight(vh, vw);
  const layers = {} as Record<LayerKey, ExplodeLayer>;
  let light: ExplodeLight = { ty: 0, sx: 1, sy: 1, opacity: 0 };
  /* aralık kademeli (0.02) → aynı kare aynı dizgeyi üretir, st() yazımı atlar */
  const gapQ = Math.round((stackShown ? ease(tOpen) * (1 - ease(tClose)) : 0) * 50) / 50;
  /* ışık: takas karesinde KAPALI (yığın fotoğraf gibi karanlık), aralık açılınca yanar;
     kapanışın ilk üçte birinde söner ki takasa kadar 420 ms'lik geçiş bitmiş olsun */
  const lit = stackShown && gapQ > 0.04 && tClose < 0.35;
  const activeSet = ci >= 0 && ci < CLAIM_LAYERS.length ? CLAIM_LAYERS[ci] : [];
  const psc = focusPose.sc;

  if (layered && stack) {
    /* ekran koordinatında yığın: kutu merkezi (vw/2 + x, y + ch/2), kare merkezi gövdeye kaymış */
    const cyS = focusPose.y + ch / 2 + (stack.cy - ch / 2) * psc;
    const topS = cyS - (stack.S / 2) * psc + stack.bunY0 * psc;
    const botS = cyS - (stack.S / 2) * psc + stack.bunY1 * psc;
    const H = botS - topS;
    const MARGIN = 12;
    const upRoom = Math.max(0, topS - MARGIN);
    /* mobilde alt sınır metin bloğunun üstü: en uzun iddia metninde (ET, 3 satır) blok üstü ~%63 vh,
       bu yüzden %62 (ölçüldü: %65'te −2 px çakışıyordu); masaüstünde viewport */
    const downRoom = Math.max(0, (mobile ? vh * 0.62 : vh) - botS - MARGIN);
    /* istenen açıklık gövdenin %38'i; sığmazsa daralt (ölçek DEĞİL, aralık) */
    const g = Math.min((EXPLODE_SPREAD * H) / 4, (upRoom + downRoom) / 4);
    /* aşağıda yer yoksa yığın yukarı doğru açılır (alt ekmek olduğu yerde kalır) */
    const dDown = Math.min(2 * g, downRoom);
    const off = dDown - 2 * g;
    const mid = (LAYER_ORDER.length - 1) / 2;
    LAYER_ORDER.forEach((k, i) => {
      const ty = Math.round((((i - mid) * g + off) * gapQ) / psc);
      /* ışık yanınca yalnızca aktif katman 1; DİĞER TÜMÜ söner (.13 — sadece silüet). Takas
         karesinde (ışık kapalı) hepsi .35: fotoğrafın sönük hâliyle aynı. */
      layers[k] = { ty, opacity: lit ? (activeSet.includes(k) ? 1 : 0.13) : 0.35 };
    });
    /* ışık: aktif katman(lar)ın birleşik kutusunu saran elips — katmanla birlikte kayar */
    const set = activeSet.length ? activeSet : ["peynir" as LayerKey];
    let y0 = Infinity, y1 = -Infinity, w = 0;
    for (const k of set) {
      const L = stack.layers[k];
      y0 = Math.min(y0, L.y0 + layers[k].ty);
      y1 = Math.max(y1, L.y1 + layers[k].ty);
      w = Math.max(w, L.w);
    }
    light = {
      ty: Math.round((y0 + y1) / 2 - stack.S / 2),
      sx: Math.round(((1.3 * w) / stack.S) * 100) / 100,
      sy: Math.round(((0.85 * (y1 - y0)) / stack.S) * 100) / 100,
      opacity: lit ? 0.5 : 0,
    };
  } else {
    for (const k of LAYER_ORDER) layers[k] = { ty: 0, opacity: 0.35 };
  }
  void cw;

  /* Koni kaynağı: tavan değil, burgerin hemen üstü. Hero pozunda kutu üstü heroBaseY, ölçek 1+FOCUS_ZOOM
     merkez etrafında; gövde üst kenarı + gövde yüksekliğinin %25'i kadar yukarı. Ürün başına sabit. */
  const hz = 1 + FOCUS_ZOOM;
  const heroTop = heroBaseY(vh) + ch / 2 - (ch * hz) / 2;
  const pb = env.photoBody ?? { y0: 0, y1: 1 };
  const bodyTop = heroTop + pb.y0 * ch * hz;
  const bodyHpx = (pb.y1 - pb.y0) * ch * hz;
  const raysOriginY = Math.round(((bodyTop - 0.25 * bodyHpx) / vh) * 1000) / 1000;

  const explode: ExplodeFrame = {
    shown: stackShown,
    gap: gapQ,
    photoDim,
    transform:
      "translate(-50%,0) translate(" +
      focusPose.x.toFixed(1) +
      "px," +
      focusPose.y.toFixed(1) +
      "px) scale(" +
      psc.toFixed(3) +
      ") rotate(0deg)",
    layers,
    light,
  };

  return {
    bright,
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
    explode,
    raysOriginY,
  };
}

/** slot i → MENU[(active + i − CENTER) mod N] — hiçbir ürün iki kez görünmez */
export function slotIndex(active: number, i: number, n: number = N): number {
  return (((active + i - CENTER) % n) + n) % n;
}
