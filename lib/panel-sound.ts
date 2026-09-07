"use client";

/** Panel sesi: autoplay kilidi bir kullanıcı dokunuşuyla açılır; tercih localStorage "mag:panel-sound". */
const KEY = "mag:panel-sound";
const SRC = "/sounds/order.wav"; // order.mp3 gelince burayı değiştir
let el: HTMLAudioElement | null = null;
let unlocked = false;

export function soundPref(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
export function setSoundPref(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* yok say */
  }
}
export function isUnlocked(): boolean {
  return unlocked;
}
/** Kullanıcı dokunuşu içinde çağır. */
export async function unlockSound(): Promise<boolean> {
  try {
    el = el ?? new Audio(SRC);
    el.preload = "auto";
    el.volume = 0.9;
    el.muted = true;
    await el.play();
    el.pause();
    el.currentTime = 0;
    el.muted = false;
    unlocked = true;
  } catch {
    unlocked = false;
  }
  return unlocked;
}
/* Art arda gelen siparişlerde ses üst üste binmesin: bir çalma bitmeden yenisi tetiklenirse
   yok sayılır (en fazla SOUND_GAP_MS'de bir çalar). Tek yoklama turunda 3 sipariş gelse de tek uyarı. */
const SOUND_GAP_MS = 1500;
let lastPlay = 0;

export function playOrderSound(): void {
  if (!unlocked || !el || !soundPref()) return;
  const now = Date.now();
  if (now - lastPlay < SOUND_GAP_MS) return;
  lastPlay = now;
  el.currentTime = 0;
  el.play().catch(() => {});
}
