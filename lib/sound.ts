/**
 * Ürün değişim sesi + ses tercihi. Dosya (public/sounds/switch.mp3) gelince SND.switch'e yaz;
 * null iken WebAudio yer tutucusu çalar. Tercih localStorage "mag:sound".
 */
export const SND: { switch: string | null; stage: string | null } = {
  switch: null,
  /* public/sounds/stage.mp3 gelince buraya yaz; yokken WebAudio yer tutucusu çalar */
  stage: null,
};

/** Katman sesi: hızlı kaydırmada üst üste binmesin — son çalmadan bu yana en az bu kadar geçmeli */
const STAGE_MIN_GAP_MS = 180;
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

/** İlk kullanıcı dokunuşunda AudioContext'i önceden oluştur — ilk sesin geçiş animasyonunu dondurmaması için. */
export function warmAudio(): void {
  if (SND.switch || actx) return;
  try {
    const Ctx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (Ctx) actx = new Ctx();
  } catch {
    /* yok say */
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

let stageEl: HTMLAudioElement | null = null;
let lastStage = 0;

/**
 * Katman değişimi sesi — "switch"ten daha tok ve kısa.
 * Ses anahtarına ve prefers-reduced-motion'a uyar; 180 ms içinde ikinci kez çalmaz.
 */
export function playStage(): void {
  if (!soundOn) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastStage < STAGE_MIN_GAP_MS) return;
  lastStage = now;

  if (SND.stage) {
    if (!stageEl) {
      stageEl = new Audio(SND.stage);
      stageEl.preload = "auto";
    }
    stageEl.currentTime = 0;
    stageEl.volume = 0.5;
    stageEl.play().catch(() => {});
    return;
  }
  try {
    const Ctx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!Ctx) return;
    actx = actx || new Ctx();
    const t = actx.currentTime,
      o = actx.createOscillator(),
      g = actx.createGain();
    /* switch'e göre daha tok: üçgen dalga, daha alçak frekans, daha kısa sönüm */
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + 0.12);
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
