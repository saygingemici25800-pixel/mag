/**
 * Teslimat bölgeleri. Artık PANELDEN yönetiliyor (settings.zones) — buradaki liste
 * VARSAYILAN: veritabanında kayıt yoksa ya da bozuksa site bununla çalışır.
 *
 * Tek kaynak kuralı: çalışma zamanında bölgeler `lib/settings.ts` → Settings.zones
 * üzerinden gelir. Bu dosyadaki ZONES yalnızca fallback ve tip tanımıdır; doğrudan
 * kullanan kod, panelden yapılan değişikliği GÖRMEZ.
 */
export interface Zone {
  id: string;
  name: string;
  /** minimum sepet tutarı (₺) */
  minCart: number;
  /** kurye ücreti (₺) */
  fee: number;
  /** tahmini teslim süresi (dk) — panelden girilir, müşteriye gösterilir */
  etaMinutes?: number;
  /** false ise "şu an bu mahalleye teslimat yok": listede seçilemez, sipariş kabul edilmez */
  active?: boolean;
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

/** Varsayılan listeden bölge bul. ÇALIŞMA ZAMANINDA panel listesini kullanın:
    `findZone(settings.zones, id)` — bu fonksiyon yalnızca fallback içindir. */
export function getZone(id: string | null | undefined): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}

/** Verilen listede bölge bul (panelden gelen liste ya da varsayılan). */
export function findZone(zones: Zone[] | null | undefined, id: string | null | undefined): Zone | undefined {
  return (zones ?? ZONES).find((z) => z.id === id);
}

/** Müşteriye gösterilecek bölgeler: kapalı olanlar da döner (arayüz "kapalı" diye işaretler). */
export function orderedZones(zones: Zone[] | null | undefined): Zone[] {
  return (zones ?? ZONES).slice();
}

/** Bölge şu an teslimata açık mı? (active tanımsızsa AÇIK sayılır — eski kayıtlar bozulmasın) */
export function zoneActive(z: Zone | undefined): boolean {
  return Boolean(z) && z!.active !== false;
}

/** Panelden gelen ham veriyi şemaya oturt: bozuk kayıt siteyi kırmasın. */
export function normalizeZones(raw: unknown): Zone[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Zone[] = [];
  for (const r of raw as Partial<Zone>[]) {
    const id = typeof r?.id === "string" ? r.id.trim() : "";
    const name = typeof r?.name === "string" ? r.name.trim() : "";
    if (!id || !name) continue; // kimliksiz/adsız kayıt atlanır
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : d);
    out.push({
      id,
      name,
      minCart: num(r.minCart, 0),
      fee: num(r.fee, 0),
      etaMinutes: typeof r.etaMinutes === "number" && r.etaMinutes > 0 ? Math.round(r.etaMinutes) : undefined,
      active: r.active !== false,
    });
  }
  /* Hiç geçerli kayıt kalmadıysa null → çağıran varsayılana düşer. */
  return out.length ? out : null;
}
