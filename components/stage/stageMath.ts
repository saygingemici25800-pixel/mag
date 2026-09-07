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
export const CENTER = 4; // odaklanan slot: p = i − CENTER ∈ [−4..3] (referans SLOTS); görünür |p|≤2, |p|≥3 hazır bekler (opacity 0)
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
  /** görsel opaklığı = parlaklık (siyah silüet üstünde) — filtre değil */
  bright: number;
  /** yansıma çizilsin mi: |p| ≥ 3 kartlar ekran dışı — maske + blur maliyeti boşa gitmesin */
  refl: boolean;
  filter: string;
  z: number;
}

/* ---- İddia bölümü: tek planda akış (burger BÜTÜN, katman/parçalanma yok) ---- */
/** Durak başına yatay merkez, viewport genişliğinin oranı (+ sağ). Mobilde yarısı. */
export const CLAIM_X = [0.26, -0.26, 0.22, -0.26] as const;
/** Durak başına dikey merkez, viewport YÜKSEKLİĞİNİN oranı (+ aşağı). Mobilde yarısı. */
export const CLAIM_Y = [-0.14, -0.06, 0.04, 0.14] as const;
/** Metin bloğunun tarafı: burgerin karşısındaki boş alan (c0 sol, c1 sağ, c2 sol, c3 sağ) */
export const CLAIM_SIDE = ["left", "right", "left", "right"] as const;
/** Aşama başına dönüş (derece), c0 → c3 doğrusal */
export const CLAIM_ROT = [-2, -0.667, 0.667, 2] as const;
/** Ölçek: kenarlarda 1.0, ortada 1.03 */
export const CLAIM_SCALE = [1, 1.03, 1.03, 1] as const;
/** Metin geçişi (CSS ile aynı) */
export const CLAIM_TEXT_MS = 420;

export interface ClaimFlow {
  /** akış etkin: iddia bölümündeyiz (c0..c3) */
  on: boolean;
  /** metin tarafı: c0/c1 sol, c2/c3 sağ */
  side: "left" | "right";
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
  arrows: { opacity: number };
  /** hüzme + havuz + armatür opaklığı: hero'da 1, dalışa doğru söner, kapanışta burgerle geri gelir */
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
  /** ilerleme çubuğu + sayaç opaklığı */
  track: number;
  /** ışık konisi (LightRays) opaklığı */
  rays: number;
  /** koninin çıkış noktası (vh oranı): odaktaki burgerin üst kenarının biraz üstü */
  raysOriginY: number;
  /** sağ alt "Sipariş ver" pill'i: dive'dan itibaren, kapanışta kaybolur */
  cta: number;
  /** iddia bölümü: yatay akış (metin tarafı) */
  flow: ClaimFlow;
}

export interface Env {
  vw: number;
  vh: number;
  /** slot başına en/boy oranı (kart içindeki contain kutusu) ve görsel ağırlık merkezi cx (lib/cutCenters.json) */
  slots?: { ar: number; cx: number }[];
}

export function heroSpacing(vw: number): number {
  return Math.min(vw * 0.28, 460); // komşular arası — iç içe geçmez, dıştakiler kenardan görünür
}
export function heroBaseY(vh: number): number {
  return vh * 0.4; // where the focus piece sits
}

/* ---- Hero referansı (docs/ref/hero/hero.html) — sayılar birebir ---- */
export const HERO_MOBILE_MAX = 760; // referans: innerWidth <= 760
export const HERO_SIDE_BRIGHT = 0.07;
export const HERO_REFL_OPACITY = 0.18;
export const DEFAULT_ASPECT_MATH = 1.5;
export interface HeroCard {
  mobile: boolean;
  /** kart kutusu: masaüstü 66vh × 52vh, mobil min(58vh,100vw) × min(46vh,80vw) */
  w: number;
  h: number;
  /** komşu aralığı: masaüstü 33vh, mobil 38vw */
  spacing: number;
  /** kart altı: 26vh */
  bottom: number;
  /** |p| başına yukarı kayma: 0.6vh */
  liftPer: number;
}
export function heroCard(vw: number, vh: number): HeroCard {
  const m = vw <= HERO_MOBILE_MAX;
  return {
    mobile: m,
    w: m ? Math.min(0.58 * vh, vw) : 0.66 * vh,
    h: m ? Math.min(0.46 * vh, 0.8 * vw) : 0.52 * vh,
    spacing: m ? 0.38 * vw : 0.33 * vh,
    bottom: 0.26 * vh,
    liftPer: 0.006 * vh,
  };
}
/** ölçek: odak 1, yanlar max(.55, .72 − (a−1)·.06); 0<a<1 arası tween için doğrusal (tam sayılarda referansla aynı) */
export function heroScale(a: number): number {
  return a < 1 ? lerp(1, 0.72, a) : Math.max(0.55, 0.72 - (a - 1) * 0.06);
}
/** parlaklık: odak 1, yanlar .07 */
export function heroBright(a: number): number {
  return a < 1 ? lerp(1, HERO_SIDE_BRIGHT, a) : HERO_SIDE_BRIGHT;
}
/** kartın içindeki görsel kutusu (contain, alta yaslı): yükseklik */
export function contentHeight(card: HeroCard, ar: number): number {
  return Math.min(card.h, card.w / ar);
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

  /* ---- iddia bölümü: dört durak ----
     Burger duraklar arasında hem yatayda hem dikeyde akar (CLAIM_X / CLAIM_Y), hafifçe döner,
     ölçek 1→1.03→1. Aralar scroll'a bağlı sürekli: smooth() ile geçilir, kademeli zıplama yok. */
  const claimsOn = claimsT > 0 && claimsT < 1 && !outro;
  /* aşama ekseni: c0 merkezi 0, c3 merkezi 3 — segment sınırlarına göre sürekli konum */
  const cSpan = (S.c3[1] - S.c0[0]) / 4;
  const flowT = clamp((p - (S.c0[0] + cSpan / 2)) / (cSpan * 3)) * 3; // 0..3 arası sürekli
  const fi = Math.min(2, Math.floor(flowT));
  const ft = smooth(clamp(flowT - fi));
  const xk = mobile ? 0.5 : 1; // mobilde yatay mesafe yarıya
  const flowX = lerp(CLAIM_X[fi], CLAIM_X[fi + 1], ft) * vw * xk;
  const flowY = lerp(CLAIM_Y[fi], CLAIM_Y[fi + 1], ft) * vh * xk;
  const flowRot = lerp(CLAIM_ROT[fi], CLAIM_ROT[fi + 1], ft);
  const flowSc = lerp(CLAIM_SCALE[fi], CLAIM_SCALE[fi + 1], ft);
  /* Akış boyunca ölçek TABANI sabit: en uçtaki aşama (|x| en büyük, dönüş en büyük) viewport'a sığmalı.
     Taban aşamalara göre değişseydi ölçek 1→1.03 yerine sığma kısıtıyla dalgalanırdı. */
  const flowExtreme = Math.max(...CLAIM_X.map((v) => Math.abs(v))) * vw * xk;
  const flowRotMax = (Math.max(...CLAIM_ROT.map((v) => Math.abs(v))) * Math.PI) / 180;
  if (tOut > 0) upT = upT * (1 - ease(Math.min(tOut1 * 1.6, 1)));

  /* background */
  /* limon perde: manifestoya girerken 0→1, çıkarken 1→0 (renk CSS'te, burada yalnızca güç) */
  let bright = tPay > 0 ? ease(Math.min(tPay / 0.42, 1)) : 0;
  if (tRange > 0) bright = 1 - ease(Math.min(tRange / 0.32, 1));
  const lm = tPay > 0.32 && tRange < 0.3;

  /* the arc */
  const card = heroCard(vw, vh);
  /* eski poz birimi: dalış/iddia/manifesto pozları bu görsel yüksekliğine göre yazıldı (kutu üstü y, merkez etrafında ölçek) */
  const hOld = defaultCutoutHeight(vh, vw);
  const slotAr = (i: number) => env.slots?.[i]?.ar || DEFAULT_ASPECT_MATH;
  /* hero'da olma ağırlığı: odak büyütmesi ve ağırlık merkezi düzeltmesi yalnızca hero DIŞINDA (referans carousel birebir) */
  const heroW = tOut > 0 ? ease(tOut) : 1 - fanE;
  const items: ItemStyle[] = [];
  for (let i = 0; i < N; i++) {
    const t = i - CENTER - offset; // t_eff
    const a = Math.abs(t);
    // hero / fan pose
    /* HERO — referans carousel: x = p·spacing, ölçek heroScale(a), lift a·0.6vh, parlaklık .07 (odak 1).
       Eski koordinatta ifade edilir (kutu üstü y, merkez etrafında ölçek sc·hOld); itme anında karta çevrilir.
       Kartın görsel kutusu alta yaslı contain (yükseklik hc): görsel yüksekliği s·hc = sc·hOld. */
    const hc = contentHeight(card, slotAr(i));
    const hs = heroScale(a);
    const closed = {
      x: t * card.spacing,
      y: vh - card.bottom - a * card.liftPer - (hc * hs) / 2 - hOld / 2,
      sc: (hs * hc) / hOld,
      rot: 0,
      br: heroBright(a),
      bl: 0,
      op: 1,
    };
    /* yelpaze: hero pozundan türetilir (yanlar dışarı açılır, hafif döner ve aydınlanır) */
    const opened = {
      x: closed.x * 1.16,
      y: closed.y + a * a * 4,
      sc: closed.sc,
      rot: t * 1.2,
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
      /* dalışın hedefi = akışın ilk aşama konumu (c0): iddia bölümüne sıçramasız girsin */
      const fx = lerp(x, CLAIM_X[0] * vw * xk, diveE);
      const fy = lerp(y, claimY + CLAIM_Y[0] * vh * xk, diveE);
      const fsc = lerp(sc, mobile ? 1.95 : 2.25, diveE);
      /* dalışın hedef dönüşü = akışın ilk aşaması (−2°): iddiaya girerken dönüş sıçraması olmaz */
      const frot = lerp(rot, CLAIM_ROT[0], diveE);
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
      /* Tek plan: yatay akış. Dikey sabit (claimY), ölçek ~1, hafif dönüş; parlaklık tam (karartma yok).
         Yatay konum aşağıda, ağırlık merkezi düzeltmesinden SONRA kilitlenir (hedef = görselin merkezi). */
      x = lerp(x, flowX, focusW);
      y = lerp(y, claimY + flowY, focusW);
      sc = lerp(sc, (mobile ? 1.95 : 2.25) * flowSc, focusW);
      br = lerp(br, 1, focusW);
      rot = lerp(rot, flowRot, focusW);
    }
    if (focusW > 0 && tPay > 0) {
      /* manifestoya giriş, akışın bitiş pozundan (c3) başlar */
      const fy = claimY + CLAIM_Y[3] * vh * xk;
      const fsc = (mobile ? 1.95 : 2.25) * CLAIM_SCALE[3];
      const frot = CLAIM_ROT[3];
      const fbr = 1;
      x = lerp(x, lerp(CLAIM_X[3] * vw * xk, 0, payE), focusW);
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
    sc *= 1 + FOCUS_ZOOM * focusW * (1 - heroW);

    if (outro) {
      /* p=1'deki kare, p=0'daki hero karesinin aynısı olmalı ki geçiş görünmesin */
      const hsc = closed.sc;
      const hx = closed.x,
        hy = closed.y,
        hrot = closed.rot;
      const hbr = closed.br,
        hbl = closed.bl;
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
    /* Burger dalıştan manifestoya kadar viewport'a SIĞMALI: hiçbir karede kırpılmaz. Kutu merkezi
       ağırlık düzeltmesiyle kayar (aşağıdaki satır), dönüş ~%2 pay ister; ölçek min(poz, sığan) — sürekli. */
    if (i === CENTER && (tDive > 0 || claimsT > 0) && tRange === 0) {
      /* Hedef konum: akıştayken görselin merkezi flowX (ağırlık düzeltmesinden bağımsız), dışında mevcut x.
         Dönüş de yatayda yer ister (görsel köşeleri): yarı genişlik |cos| + yarı yükseklik |sin| ile büyür. */
      /* dalış + akış: aynı sabit taban (geçişte ölçek sıçraması ve kenar taşması olmasın) */
      const inFlow = (claimsT > 0 || tDive > 0) && claimsT < 1 && tPay === 0;
      const w = hOld * slotAr(i);
      const M = mobile ? 10 : 16;
      /* akışta: en uç aşamaya göre sabit taban (dolayısıyla aşamalar arası ölçek yalnızca CLAIM_SCALE'den gelir);
         dışında: mevcut konuma göre. Yarı genişlik = yarı genişlik·|cos θ| + yarı yükseklik·|sin θ|. */
      /* Dalıştan akışa geçişte (claimsT küçük) dönüş henüz −4°'den sönüyor: gerçek dönüşle akış
         ucundan büyük olanı al ki o karelerde de kırpılma olmasın. */
      const cxTarget = inFlow ? Math.max(flowExtreme, Math.abs(x)) : Math.abs(x);
      const th2 = inFlow ? Math.max(flowRotMax, Math.abs((rot * Math.PI) / 180)) : Math.abs((rot * Math.PI) / 180);
      const halfW = (w / 2) * Math.cos(th2) + (hOld / 2) * Math.sin(th2);
      const room = vw / 2 - M - cxTarget;
      sc = Math.min(sc, (room / halfW) * (inFlow ? flowSc : 1));
      /* DİKEY sığma: duraklar y ekseninde de kayıyor (CLAIM_Y). Kartın görsel kutusu claimY + flowY
         merkezinde; en uç durak viewport dışına taşmamalı. Yarı yükseklik dönüşle birlikte büyür. */
      if (inFlow) {
        /* En kısıtlayıcı durak: merkez claimY + CLAIM_Y[i]·vh; üstte claimY+dy, altta vh−(claimY+dy) yer var.
           Her durağı ayrı ayrı değerlendirip en darını al. */
        const halfH = (hOld / 2) * Math.cos(th2) + (w / 2) * Math.sin(th2);
        /* claimY eski koordinatta KUTU ÜSTÜ; görselin merkezi y + hOld/2 (ölçek 1 birimde).
           Ölçek merkez etrafında olduğu için sınır: merkez ± halfH·s. */
        let roomY = Infinity;
        for (const cy of CLAIM_Y) {
          const c = claimY + cy * vh * xk + hOld / 2;
          roomY = Math.min(roomY, c - M, vh - c - M);
        }
        sc = Math.min(sc, (roomY / halfH) * flowSc);
      }
    }
    /* görsel ağırlık merkezi düzeltmesi: (0.5 − cx) × görselGenişliği × ölçek.
       Tek yana taşan cutout'lar kutu merkezine göre değil, göze göre ortalanır.
       İddia akışında hedef konum GÖRSELİN merkezidir: düzeltme uygulanır, sonra hedefe kilitlenir. */
    const slot = env.slots?.[i];
    if (slot) x += (0.5 - slot.cx) * hOld * slot.ar * sc * (1 - heroW);
    if (i === CENTER && focusW > 0 && (claimsT > 0 || diveE > 0) && claimsT < 1 && tPay === 0) {
      /* dönüş görselin merkezini yatayda kaydırır (kart origin'i alt-orta): telafi et.
         Kaydırma = d·sin(θ), d = görsel yüksekliğinin yarısı. */
      const dRot = ((sc * hOld) / 2) * Math.sin((rot * Math.PI) / 180);
      /* dalışta hedef akışın ilk aşaması; kilit dalış ilerledikçe (diveE) devreye girer, sıçrama yok */
      const target = claimsT > 0 ? flowX : CLAIM_X[0] * vw * xk;
      const lock = claimsT > 0 ? 1 : diveE;
      x = lerp(x, target + dRot, focusW * lock);
    }

    const brc = Math.max(0, Math.min(1.2, br)); /* alt sınır yok: hero yanları .07 (referans) */
    /* yan slotlar soluk: saturate(1 − a·0.3); dive/claims/pay odaktaki için a=0 → 1 */
    const sat = Math.max(0.1, 1 - Math.min(a, 3) * 0.3);
    const satq = Math.round(sat * 20) / 20;
    /* blur: 0.5px adımlara yuvarla (her karede yeni filtre üretilmesin), 0.4 altını yazma */
    const blq = Math.round(Math.min(bl, 9) * 2) / 2;
    /* eski koordinat → kart: görsel merkezi C = (vw/2 + x, y + hOld/2), görsel yüksekliği sc·hOld = s·hc.
       Kartın döndürme/ölçek merkezi alt-orta (P, transform-origin 50% 100%); C = P + R(θ)·(0, −hc·s/2) →
       P = C − (d·sinθ, −d·cosθ). Hero pozunda bu birebir referansı verir: translate(-50% + p·spacing, −lift) scale(s). */
    const s = (sc * hOld) / hc;
    const d = (hc * s) / 2;
    const th = (rot * Math.PI) / 180;
    const Cx = vw / 2 + x,
      Cy = y + hOld / 2;
    const X = Cx - d * Math.sin(th) - vw / 2;
    const Y = Cy + d * Math.cos(th) - (vh - card.bottom);
    items.push({
      transform: "translate(calc(-50% + " + X.toFixed(1) + "px)," + Y.toFixed(1) + "px) rotate(" + rot.toFixed(2) + "deg) scale(" + s.toFixed(3) + ")",
      opacity: Math.max(0, outro ? op : op * (1 - upT)).toFixed(3),
      /* karartma filtreyle değil: siyah silüet üstünde görsel opaklığı */
      bright: Math.round(Math.min(1, brc) * 1000) / 1000,
      /* Yansıma yalnızca hero/yelpazede: iddia akışında kart DÖNÜYOR ve blur(7px) yansıma her karede
         yeniden rasterleniyordu (ölçüm: masaüstü p95 33 → 50 ms). Akışta zemin havuzu zaten var. */
      refl: a < 2.5 && claimsT === 0 && tPay === 0,
      /* filtre yalnızca yelpazede yan slotlar için (doygunluk/bulanıklık); parlaklık artık opaklıkta */
      filter: satq < 0.99 || bl >= 0.4 ? (satq < 0.99 ? "saturate(" + satq.toFixed(2) + ")" : "") + (bl >= 0.4 ? " blur(" + blq.toFixed(1) + "px)" : "") : "none",
      z: Math.round(10 - Math.min(a, 4)), // referans: z = 10 − |p|
    });
  }

  /* ışık (hüzme, havuz, armatür): hero'da tam, yelpazede %28'e iner, dalış/manifesto/panelde söner; kapanışta
     burgerin yükselmesiyle (riseE^1.8) geri gelir — burger oturunca ışık da tam, daha erken değil. */
  const riseE = smooth(tOut1);
  const lightIn = Math.pow(riseE, 1.8);
  const aura = tOut > 0 ? lightIn : Math.max(0, (1 - fanE * 0.72) * (1 - Math.max(payE, upT)));
  /* Işık konisi: hero'da tam, yelpazede kısılır, dalış/manifesto/panelde söner; kapanışta burgerin
     yükselmesiyle geri gelir (eski formül birebir). */
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

  const track = tOut > 0 ? clamp((tOut2 - 0.3) / 0.5) : 1 - upT;
  const arrowsO = Math.max(heroOut, clamp((tOut2 - 0.55) / 0.4));

  /* Koni kaynağı: odaktaki burgerin ÜST kenarının biraz üstü. Kart alta yaslı (bottom = card.bottom),
     görsel yüksekliği hc·heroScale(0) = hc; üst kenar = vh − card.bottom − hc. Oradan gövdenin
     %25'i kadar yukarı çıkılır (eski davranışla aynı oran). */
  const focusHc = contentHeight(card, slotAr(CENTER));
  const rayTop = vh - card.bottom - focusHc;
  const raysOriginY = Math.round(((rayTop - 0.25 * focusHc) / vh) * 1000) / 1000;

  const flow: ClaimFlow = {
    on: claimsOn,
    /* metin burgerin BOŞ tarafında: burger sağdayken (c0/c1) metin solda, sola geçince (c2/c3) sağda */
    /* metin burgerin KARŞI tarafında; durak ortasını geçince değişir (yarı yolda) */
    side: CLAIM_SIDE[Math.min(3, Math.round(flowT))],
  };

  return {
    bright,
    lm,
    items,
    arrows: { opacity: arrowsO },
    aura,
    hero,
    dive,
    ci,
    pay,
    faq,
    foot,
    panelVeil,
    track,
    rays,
    raysOriginY,
    cta,
    flow,
  };
}

/** slot i → MENU[(active + i − CENTER) mod N] — hiçbir ürün iki kez görünmez */
export function slotIndex(active: number, i: number, n: number = N): number {
  return (((active + i - CENTER) % n) + n) % n;
}
