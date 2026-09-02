/** Depo seçimi — env'e göre: Supabase anahtarları varsa Supabase, yoksa yerel stub. Kod değişmez. */
import { hasSupabaseServer } from "@/lib/env";
import type { OrderStore, PushStore } from "@/lib/orders";
import { FileOrderStore, FilePushStore } from "@/lib/orders-store";
import { SupabaseOrderStore, SupabasePushStore } from "@/lib/supabase-store";

const g = globalThis as unknown as { __magOrderStore?: OrderStore; __magPushStore?: PushStore; __magStoreMode?: "supabase" | "stub" };

export function storeMode(): "supabase" | "stub" {
  return hasSupabaseServer() ? "supabase" : "stub";
}
export function getOrderStore(): OrderStore {
  if (!g.__magOrderStore || g.__magStoreMode !== storeMode()) {
    g.__magStoreMode = storeMode();
    g.__magOrderStore = g.__magStoreMode === "supabase" ? new SupabaseOrderStore() : new FileOrderStore();
    g.__magPushStore = g.__magStoreMode === "supabase" ? new SupabasePushStore() : new FilePushStore();
  }
  return g.__magOrderStore;
}
export function getPushStore(): PushStore {
  getOrderStore();
  return g.__magPushStore!;
}
