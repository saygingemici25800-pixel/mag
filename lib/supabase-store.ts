/** Supabase depo — OrderStore arayüzü, `orders` tablosu (0001_orders.sql).
    24 Eyl 2026: push kanalı kaldırıldı; `push_subscriptions` tablosu VERİTABANINDA
    DURUYOR (kullanıcı kararı) ama kod tarafından hiç okunmuyor/yazılmıyor. */
import type { Order, OrderStore } from "@/lib/orders";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeSettings, type Settings, type SettingsStore } from "@/lib/settings";
import type { Report, ReportStore } from "@/lib/reports";

export class SupabaseOrderStore implements OrderStore {
  async create(order: Order): Promise<Order> {
    const { data, error } = await supabaseAdmin().from("orders").insert(order).select().single();
    if (error) throw new Error("supabase insert: " + error.message);
    return data as Order;
  }
  async get(id: string): Promise<Order | null> {
    const { data, error } = await supabaseAdmin().from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("supabase select: " + error.message);
    return (data as Order | null) ?? null;
  }
  async list(limit = 200, paidOnly = false, since?: string): Promise<Order[]> {
    let q = supabaseAdmin().from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
    if (paidOnly) q = q.eq("payment_status", "paid");
    /* since: son yoklamadan sonra DEĞİŞEN kayıtlar. created_at yeni sipariş için, aşama damgaları
       ise mevcut siparişin güncellenmesi için gerekli — biri bile sonraysa kayıt döner. */
    if (since) q = q.or(`created_at.gte.${since},accepted_at.gte.${since},closed_at.gte.${since},cancelled_at.gte.${since}`);
    const { data, error } = await q;
    if (error) throw new Error("supabase list: " + error.message);
    return (data ?? []) as Order[];
  }
  async update(id: string, patch: Partial<Order>): Promise<Order | null> {
    const { data, error } = await supabaseAdmin().from("orders").update(patch).eq("id", id).select().maybeSingle();
    if (error) throw new Error("supabase update: " + error.message);
    return (data as Order | null) ?? null;
  }
}

/* ---- Ayarlar — Supabase (settings tablosu, tek satır: id = 'singleton') ---- */
export class SupabaseSettingsStore implements SettingsStore {
  async get(): Promise<Settings> {
    const { data, error } = await supabaseAdmin().from("settings").select("*").eq("id", "singleton").maybeSingle();
    /* 18 Eyl 2026: hata YUTULUYORDU. Okuma başarısızsa (yanlış anahtar/proje, ağ,
       eksik kolon) sessizce VARSAYILANA düşülüyordu: panel "sipariş kapalı" dese
       bile site açık görünüyor, panelden girilen bölge/fiyat hiç yansımıyordu —
       hepsi hatasız gibi. Artık loglanıyor; davranış aynı kalıyor (varsayılana
       düşmek doğru: site ayakta kalmalı) ama SEBEP görünür oluyor. */
    if (error) console.error("[settings okunamadı — VARSAYILAN kullanılıyor]", error.message);
    return normalizeSettings(data ?? undefined);
  }
  async patch(p: Partial<Omit<Settings, "updated_at">>): Promise<Settings> {
    const next = normalizeSettings({ ...(await this.get()), ...p, updated_at: new Date().toISOString() });
    /* YALNIZCA istenen alanlar yazılır (tüm satır değil). Neden: normalizeSettings
       eksik alanları varsayılanla doldurur; tüm satırı göndermek, şemada HENÜZ
       OLMAYAN bir kolonu (ör. migration uygulanmadan zones) her yazmaya iliştirip
       "sipariş açık/kapalı" gibi ilgisiz işlemleri de bozuyordu. */
    const row: Record<string, unknown> = { id: "singleton", updated_at: next.updated_at };
    for (const k of Object.keys(p) as (keyof typeof p)[]) row[k] = next[k];
    const { data, error } = await supabaseAdmin().from("settings").upsert(row).select().single();
    /* 17 Eyl 2026: hata YUTULUYORDU; istenen değer "kaydedildi" gibi dönüyordu.
       Migration uygulanmamışsa panel "Kaydedildi" der, veri sessizce kaybolurdu.
       Artık hata yükseltiliyor → rota 500 döner, panelde görünür. */
    if (error) throw new Error("supabase settings upsert: " + error.message);
    return normalizeSettings(data ?? next);
  }
}

/* ---- Raporlar — toplama VERİTABANINDA (0011_reports.sql) ---- */
export class SupabaseReportStore implements ReportStore {
  async report(from: string, to: string): Promise<Report> {
    /* Tek RPC: özet + günlük + saatlik + ürün + mahalle aynı taramadan çıkar.
       Satırlar Postgres'te toplanır; tarayıcıya yalnızca özet gider. */
    const { data, error } = await supabaseAdmin().rpc("panel_report", { p_from: from, p_to: to });
    if (error) throw new Error("supabase panel_report: " + error.message);
    return data as Report;
  }
  async rows(from: string, to: string): Promise<Order[]> {
    const { data, error } = await supabaseAdmin().rpc("panel_report_rows", { p_from: from, p_to: to });
    if (error) throw new Error("supabase panel_report_rows: " + error.message);
    return (data ?? []) as Order[];
  }
}
