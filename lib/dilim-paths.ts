/** Dilim dosya adları — istemci ve sunucu ortak (fs yok). Sırası: üstten alta. */
export const SLICE_NAMES = ["1-ust-ekmek", "2-malzeme", "3-kofte-peynir", "4-alt-ekmek"] as const;
export const SLICE_DIR = "/assets/dilim";

export function sliceSrc(id: string, i: number): string {
  return `${SLICE_DIR}/${id}-${SLICE_NAMES[i]}.webp`;
}

export interface SliceMeta {
  /** kaynak görselin px boyutu [w, h] */
  size: [number, number];
  /** dört dilimin dikey merkezleri, görsel yüksekliğinin yüzdesi (ışık konumu buradan; tahmin yok) */
  bandCenterPct: [number, number, number, number];
}
