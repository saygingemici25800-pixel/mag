/** Teslimat bölgeleri + minimum sepet (₺). Placeholder — tam liste ve ücretler işletmeden gelecek (spec §11.1). */
export interface Zone {
  id: string;
  name: string;
  /** minimum sepet tutarı (₺) */
  minCart: number;
  /** kurye ücreti (₺) */
  fee: number;
}

export const ZONES: Zone[] = [
  { id: "merkez", name: "Fethiye Merkez", minCart: 800, fee: 0 }, // AÇIK
  { id: "oludeniz", name: "Ölüdeniz", minCart: 1500, fee: 0 }, // AÇIK
  { id: "calis", name: "Çalış", minCart: 1000, fee: 0 }, // AÇIK
  { id: "karagozler", name: "Karagözler", minCart: 1000, fee: 0 }, // AÇIK
  { id: "hisaronu", name: "Hisarönü", minCart: 1500, fee: 0 }, // AÇIK
  { id: "ovacik", name: "Ovacık", minCart: 1500, fee: 0 }, // AÇIK
  { id: "tasyaka", name: "Taşyaka", minCart: 1000, fee: 0 }, // AÇIK
  { id: "ciftlik", name: "Çiftlik", minCart: 1200, fee: 0 }, // AÇIK
];

export function getZone(id: string | null | undefined): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
