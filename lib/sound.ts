/**
 * Ürün değişim sesi + ses tercihi. Dosya (public/sounds/switch.mp3) gelince SND.switch'e yaz;
 * null iken WebAudio yer tutucusu çalar. Tercih localStorage "mag:sound".
 */
export const SND: { switch: string | null } = { switch: null };
export const SOUND_KEY = "mag:sound";

let soundOn = true;
let actx: AudioContext | null = null;
let sndEl: HTMLAudioElement | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function isSoundOn(): boolean {
  return soundOn;
}

/** localStorage'dan oku (yalnızca istemcide). Varsayılan açık. */
export function loadSoundPref(): boolean {
  try {
    const v = window.localStorage.getItem(SOUND_KEY);
    soundOn = v === null ? true : v === "1";
  } catch {
    soundOn = true;
  }
  return soundOn;
}

export function setSoundOn(on: boolean): void {
  soundOn = on;
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* özel mod vb. */
  }
}

export function playSwitch(): void {
  if (!soundOn) return;
  if (SND.switch) {
    if (!sndEl) {
      sndEl = new Audio(SND.switch);
      sndEl.preload = "auto";
    }
    sndEl.currentTime = 0;
    sndEl.volume = 0.55;
    sndEl.play().catch(() => {});
    return;
  }
  try {
    const Ctx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!Ctx) return;
    actx = actx || new Ctx();
    const t = actx.currentTime,
      o = actx.createOscillator(),
      g = actx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(920, t);
    o.frequency.exponentialRampToValueAtTime(460, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + 0.17);
  } catch {
    /* ses yoksa sessiz geç */
  }
}

/* --- React için küçük abone deseni (useSyncExternalStore) --- */
const listeners = new Set<() => void>();
export function subscribeSound(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
let loaded = false;
export function getSoundSnapshot(): boolean {
  if (!loaded) {
    loaded = true;
    loadSoundPref();
  }
  return soundOn;
}
export function toggleSound(): void {
  setSoundOn(!soundOn);
  listeners.forEach((cb) => cb());
}
