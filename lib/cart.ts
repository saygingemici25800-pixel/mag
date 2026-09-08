"use client";

/** Sepet — localStorage "mag:cart", sayfalar arası (liste → ödeme) korunur. useSyncExternalStore ile. */
import { useSyncExternalStore } from "react";

export interface CartLine {
  qty: number;
  note: string;
  /** Çıkarılan malzemeler (ürün id'sinden bağımsız, isim listesi). Fiyatı DEĞİŞTİRMEZ. */
  removed?: string[];
}
/** Anahtar = satır kimliği (lineKey): ürün id'si + sıralı çıkarılan malzemeler */
export type CartLines = Record<string, CartLine>;

/**
 * Satır kimliği: aynı üründen "sade" ve "malzemesi çıkarılmış" iki adet AYRI satır olsun diye
 * çıkarılanlar da anahtara girer. Sıralama sabit → aynı seçim her zaman aynı anahtarı verir.
 * Örn: smooky · ["cheddar","roka"] → "smooky::cheddar|roka"
 */
export function lineKey(id: string, removed?: string[]): string {
  const r = (removed ?? []).filter(Boolean).slice().sort();
  return r.length ? `${id}::${r.join("|")}` : id;
}
/** Satır kimliğinden ürün id'sini çıkar (menü araması için) */
export function lineProductId(key: string): string {
  return key.split("::")[0];
}
const KEY = "mag:cart";
const EMPTY: CartLines = {};
let snapshot: CartLines | null = null;
const listeners = new Set<() => void>();

function read(): CartLines {
  if (snapshot) return snapshot;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as { v: number; lines: CartLines }) : null;
    snapshot = parsed && parsed.v === 1 && parsed.lines ? parsed.lines : EMPTY;
  } catch {
    snapshot = EMPTY;
  }
  return snapshot;
}
function write(next: CartLines) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, lines: next }));
  } catch {
    /* yok say */
  }
  listeners.forEach((cb) => cb());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
const getServer = () => EMPTY;

export function useCart(): CartLines {
  return useSyncExternalStore(subscribe, read, getServer);
}
export function cartAdd(id: string, qty = 1, note?: string, removed?: string[]) {
  const c = read();
  const key = lineKey(id, removed);
  const cur = c[key];
  const rem = (removed ?? cur?.removed ?? []).slice().sort();
  write({ ...c, [key]: { qty: (cur?.qty ?? 0) + qty, note: note ?? cur?.note ?? "", ...(rem.length ? { removed: rem } : {}) } });
}

/** Var olan satırın çıkarılanlarını değiştir: satır kimliği değişir, adet ve not taşınır.
    Hedef kimlikte zaten satır varsa adetler birleşir. */
export function cartSetRemoved(key: string, removed: string[]) {
  const c = read();
  const cur = c[key];
  if (!cur) return;
  const id = lineProductId(key);
  const nextKey = lineKey(id, removed);
  const rem = removed.slice().sort();
  const next = { ...c };
  delete next[key];
  const existing = next[nextKey];
  next[nextKey] = {
    qty: (existing?.qty ?? 0) + cur.qty,
    note: existing?.note || cur.note,
    ...(rem.length ? { removed: rem } : {}),
  };
  write(next);
}
export function cartSet(key: string, qty: number, note?: string) {
  const c = read();
  if (qty <= 0) {
    const next = { ...c };
    delete next[key];
    write(next);
  } else {
    const cur = c[key];
    write({ ...c, [key]: { qty, note: note ?? cur?.note ?? "", ...(cur?.removed?.length ? { removed: cur.removed } : {}) } });
  }
}
export function cartRemove(id: string) {
  cartSet(id, 0);
}
export function cartClear() {
  write(EMPTY);
}
export function cartCount(c: CartLines): number {
  return Object.values(c).reduce((s, l) => s + l.qty, 0);
}

/** Bir ürünün TÜM varyantlarındaki toplam adet (menü kartındaki "+ Ekle · 2" sayacı için) */
export function qtyOf(c: CartLines, id: string): number {
  return Object.entries(c).reduce((sum, [key, l]) => (lineProductId(key) === id ? sum + l.qty : sum), 0);
}
