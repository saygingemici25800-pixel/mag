/** Supabase depo — OrderStore / PushStore arayüzleri, `orders` ve `push_subscriptions` tabloları (0001_orders.sql). */
import type { Order, OrderStore, PushStore, PushSubscriptionRow } from "@/lib/orders";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeSettings, type Settings, type SettingsStore } from "@/lib/settings";

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
  async list(limit = 200, paidOnly = false): Promise<Order[]> {
    let q = supabaseAdmin().from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
    if (paidOnly) q = q.eq("payment_status", "paid");
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

export class SupabasePushStore implements PushStore {
  async add(sub: PushSubscriptionRow): Promise<void> {
    const { error } = await supabaseAdmin()
      .from("push_subscriptions")
      .upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
    if (error) throw new Error("supabase push upsert: " + error.message);
  }
  async list(): Promise<PushSubscriptionRow[]> {
    const { data, error } = await supabaseAdmin().from("push_subscriptions").select("endpoint,p256dh,auth");
    if (error) throw new Error("supabase push list: " + error.message);
    return (data ?? []).map((r) => ({ endpoint: r.endpoint as string, keys: { p256dh: r.p256dh as string, auth: r.auth as string } }));
  }
  async remove(endpoint: string): Promise<void> {
    await supabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}

/* ---- Ayarlar — Supabase (settings tablosu, tek satır: id = 'singleton') ---- */
export class SupabaseSettingsStore implements SettingsStore {
  async get(): Promise<Settings> {
    const { data } = await supabaseAdmin().from("settings").select("*").eq("id", "singleton").maybeSingle();
    return normalizeSettings(data ?? undefined);
  }
  async patch(p: Partial<Omit<Settings, "updated_at">>): Promise<Settings> {
    const next = normalizeSettings({ ...(await this.get()), ...p, updated_at: new Date().toISOString() });
    const { data } = await supabaseAdmin().from("settings").upsert({ id: "singleton", ...next }).select().single();
    return normalizeSettings(data ?? next);
  }
}
