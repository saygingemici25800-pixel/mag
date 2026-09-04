/**
 * Segment haritası (stageMath.ts'in aynası): masaüstü sabit; mobilde fan/dive/c0..c3/pay ×2/3.
 * Testler mobil p konumlarını masaüstü p'den bununla eşler. stageMath değişirse burası da değişmeli
 * (claims-explode.mjs bunu scroller yüksekliğiyle çapraz kontrol eder).
 */
export const S_DESKTOP = {
  fan: [0.04, 0.16], dive: [0.16, 0.28], c0: [0.28, 0.38], c1: [0.38, 0.46], c2: [0.46, 0.54], c3: [0.54, 0.62],
  pay: [0.62, 0.72], range: [0.72, 0.8], faq: [0.8, 0.87], foot: [0.87, 0.905], out1: [0.905, 0.958], out2: [0.958, 0.99],
};
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
