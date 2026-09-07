"use client";

/**
 * Site tarafında panel ayarları: "sipariş açık/kapalı" ve "tükendi" listesi.
 * /api/panel/settings GET herkese açıktır (yalnızca okuma). Sekmeler arası tutarlı olsun diye
 * modül düzeyinde tek abonelik: aynı anda kaç bileşen kullanırsa kullansın tek istek + tek zamanlayıcı.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "@/lib/settings";

const POLL_MS = 30_000;
let snapshot: Settings = DEFAULT_SETTINGS;
let started = false;
let timer = 0;
const listeners = new Set<() => void>();

async function refresh() {
  try {
    const r = await fetch("/api/panel/settings", { cache: "no-store" });
    if (!r.ok) return;
    const next = normalizeSettings(await r.json());
    /* aynı değerse yeniden render tetikleme (useSyncExternalStore referans karşılaştırır) */
    if (next.ordering_open !== snapshot.ordering_open || next.sold_out.join() !== snapshot.sold_out.join()) {
      snapshot = next;
      listeners.forEach((cb) => cb());
    }
  } catch {
    /* çevrimdışı: son bilinen değerle devam */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    void refresh();
    timer = window.setInterval(refresh, POLL_MS);
    /* sekmeye dönünce hemen tazele (kapandıysa hemen görünsün) */
    window.addEventListener("focus", refresh);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      started = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    }
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => snapshot, () => DEFAULT_SETTINGS);
}

/** Ürün tükendi mi (sepete eklenemez, menüde soluk) */
export function isSoldOut(s: Settings, id: string): boolean {
  return s.sold_out.includes(id);
}
