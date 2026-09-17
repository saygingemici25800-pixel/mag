/**
 * Panel ayarları — panelden yönetilen TÜM veriler bu tekil satırda durur.
 *
 * ALTYAPI DESENİ (yeni ayar eklerken aynısını izle):
 *  1. Settings arayüzüne alanı ekle + DEFAULT_SETTINGS'e varsayılanını yaz.
 *  2. normalizeSettings içinde ŞEMAYA OTURT — bozuk/eksik kayıt paneli açmasın,
 *     geçersizse varsayılana düş (veritabanı boşken site çalışmalı).
 *  3. Supabase tarafında kolon ekle (jsonb yeter) — supabase/migrations.
 *  4. Yazma: YALNIZCA /api/panel/settings PATCH (PANEL_KEY + service_role).
 *     Tarayıcıya service_role asla gitmez.
 *  5. Okuma: aynı rotanın GET'i herkese açık; istemci lib/useSettings ile okur.
 *
 * "sipariş açık/kapalı", "tükendi" işaretleri ve TESLİMAT BÖLGELERİ burada.
 * Depo seçimi orders ile aynı desende (Supabase varsa oradan, yoksa dosya stub'ı):
 * geliştirmede de üretimde de aynı arayüz. Sunucuda tutulur, sayfa yenilense de kalır.
 */
import { normalizeZones, ZONES, type Zone } from "@/lib/zones";

export interface Settings {
  /** false ise sitede sipariş verilemez (sepet ve ödeme "Şu an kapalıyız" der) */
  ordering_open: boolean;
  /** tükendi işaretli ürün/ek ürün id'leri (lib/menu.ts id'leri) */
  sold_out: string[];
  /** Teslimat bölgeleri — panelden yönetilir. null/bozuksa lib/zones.ts ZONES kullanılır. */
  zones: Zone[];
  /** son değişiklik (bilgi amaçlı) */
  updated_at: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ordering_open: true,
  sold_out: [],
  /* Varsayılan bölgeler koddan gelir: veritabanı boşken de sipariş alınabilir. */
  zones: ZONES,
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
    /* Kayıt yok / bozuk → koddaki varsayılan liste. Site boş veritabanıyla da çalışır. */
    zones: normalizeZones(r.zones) ?? ZONES,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : DEFAULT_SETTINGS.updated_at,
  };
}
