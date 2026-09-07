/**
 * Panel ayarları — "sipariş açık/kapalı" ve "tükendi" işaretleri.
 * Depo seçimi orders ile aynı desende (Supabase varsa oradan, yoksa dosya stub'ı):
 * geliştirmede de üretimde de aynı arayüz. Sunucuda tutulur, sayfa yenilense de kalır.
 */
export interface Settings {
  /** false ise sitede sipariş verilemez (sepet ve ödeme "Şu an kapalıyız" der) */
  ordering_open: boolean;
  /** tükendi işaretli ürün/ek ürün id'leri (lib/menu.ts id'leri) */
  sold_out: string[];
  /** son değişiklik (bilgi amaçlı) */
  updated_at: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ordering_open: true,
  sold_out: [],
  updated_at: new Date(0).toISOString(),
};

export interface SettingsStore {
  get(): Promise<Settings>;
  patch(p: Partial<Omit<Settings, "updated_at">>): Promise<Settings>;
}

/** Gelen değeri şemaya oturt (bozuk/eksik kayıt panelin açılmasını engellemesin) */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  return {
    ordering_open: typeof r.ordering_open === "boolean" ? r.ordering_open : DEFAULT_SETTINGS.ordering_open,
    sold_out: Array.isArray(r.sold_out) ? r.sold_out.filter((x): x is string => typeof x === "string") : [],
    updated_at: typeof r.updated_at === "string" ? r.updated_at : DEFAULT_SETTINGS.updated_at,
  };
}
