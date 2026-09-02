"use client";

/** Sepet — localStorage "mag:cart", sayfalar arası (liste → ödeme) korunur. useSyncExternalStore ile. */
import { useSyncExternalStore } from "react";

export interface CartLine {
  qty: number;
  note: string;
}
export type CartLines = Record<string, CartLine>;
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
export function cartAdd(id: string, qty = 1, note?: string) {
  const c = read();
  const cur = c[id];
  write({ ...c, [id]: { qty: (cur?.qty ?? 0) + qty, note: note ?? cur?.note ?? "" } });
}
export function cartSet(id: string, qty: number, note?: string) {
  const c = read();
  if (qty <= 0) {
    const next = { ...c };
    delete next[id];
    write(next);
  } else write({ ...c, [id]: { qty, note: note ?? c[id]?.note ?? "" } });
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
