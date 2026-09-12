/**
 * Segment haritası (stageMath.ts'in aynası): masaüstü sabit; mobilde fan/dive/c0..c3/pay ×2/3.
 * Testler mobil p konumlarını masaüstü p'den bununla eşler. stageMath değişirse burası da değişmeli
 * (claims-explode.mjs bunu scroller yüksekliğiyle çapraz kontrol eder).
 */
/* 12 Eyl 2026: hero→iddia geçişi (fan+dive) yarıya indi, harita yeniden normalize edildi. */
export const S_DESKTOP = {
  fan: [0.04545, 0.11364], dive: [0.11364, 0.18182], c0: [0.18182, 0.29545], c1: [0.29545, 0.38636],
  c2: [0.38636, 0.47727], c3: [0.47727, 0.56818], pay: [0.56818, 0.68182], range: [0.68182, 0.77273],
  faq: [0.77273, 0.85227], foot: [0.85227, 0.89205], out1: [0.89205, 0.95227], out2: [0.95227, 0.98864],
};
/** masaüstü scroller / eski 1200vh (stageMath.DESKTOP_TOTAL ile aynı) */
export const DESKTOP_TOTAL = 0.88;
const SHRINK = { fan: 2 / 3, dive: 2 / 3, c0: 2 / 3, c1: 2 / 3, c2: 2 / 3, c3: 2 / 3, pay: 2 / 3 };
function build() {
  const keys = Object.keys(S_DESKTOP);
  const head = S_DESKTOP.fan[0], tail = 1 - S_DESKTOP.out2[1];
  const lens = keys.map((k) => (S_DESKTOP[k][1] - S_DESKTOP[k][0]) * (SHRINK[k] ?? 1));
  const total = head + lens.reduce((a, b) => a + b, 0) + tail;
  const map = {}; let at = head / total;
  keys.forEach((k, i) => { const len = lens[i] / total; map[k] = [+at.toFixed(5), +(at + len).toFixed(5)]; at += len; });
  return { map, total: +total.toFixed(5) };
}
const M = build();
export const S_MOBILE = M.map;
export const MOBILE_TOTAL = M.total;
export const segmentsFor = (mobile) => (mobile ? S_MOBILE : S_DESKTOP);
/** masaüstü p → aynı bölümde aynı göreli konum (mobilde) */
export function mapP(pd, mobile) {
  if (!mobile) return pd;
  const D = S_DESKTOP, Mm = S_MOBILE;
  const segs = [["_hero", [0, D.fan[0]], [0, Mm.fan[0]]], ...Object.keys(D).map((k) => [k, D[k], Mm[k]]), ["_tail", [D.out2[1], 1], [Mm.out2[1], 1]]];
  for (const [, d, m] of segs) {
    if (pd >= d[0] && pd <= d[1]) { const r = (pd - d[0]) / (d[1] - d[0] || 1); return +(m[0] + r * (m[1] - m[0])).toFixed(5); }
  }
  return pd;
}
