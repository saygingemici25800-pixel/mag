"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void): () => void {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
}
const getMinute = () => Math.floor(Date.now() / 60_000);
const getServerMinute = () => -1;

/** Dakika çözünürlüklü saat; sunucu/hydration sırasında −1 (bilinmiyor). */
export function useClockMinute(): number {
  return useSyncExternalStore(subscribe, getMinute, getServerMinute);
}
