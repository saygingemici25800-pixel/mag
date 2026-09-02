// public/sounds/order.wav — programatik yeni sipariş sesi: iki tonlu, 0.8 sn, 3 tekrar (order.mp3 gelene kadar).
import { writeFileSync, mkdirSync } from "node:fs";

const SR = 22050;
const REPEATS = 3;
const BEEP = 0.8; // sn (iki ton: 0.4 + 0.4)
const GAP = 0.25;
const F1 = 880, F2 = 1318.5; // A5 → E6
const total = REPEATS * BEEP + (REPEATS - 1) * GAP;
const n = Math.round(total * SR);
const pcm = new Int16Array(n);

function env(t, dur) { // yumuşak zarf
  const a = 0.015, r = 0.12;
  if (t < a) return t / a;
  if (t > dur - r) return Math.max(0, (dur - t) / r);
  return 1;
}
for (let r = 0; r < REPEATS; r++) {
  const start = r * (BEEP + GAP);
  for (let i = 0; i < BEEP * SR; i++) {
    const t = i / SR;
    const half = BEEP / 2;
    const f = t < half ? F1 : F2;
    const tt = t < half ? t : t - half;
    const v = Math.sin(2 * Math.PI * f * t) * 0.55 + Math.sin(2 * Math.PI * f * 2 * t) * 0.12; // hafif üst harmonik
    const idx = Math.round((start + t) * SR);
    if (idx < n) pcm[idx] = Math.max(-1, Math.min(1, v * env(tt, half))) * 0.8 * 32767;
  }
}
const dataBytes = pcm.length * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(dataBytes, 40);
Buffer.from(pcm.buffer).copy(buf, 44);
mkdirSync("public/sounds", { recursive: true });
writeFileSync("public/sounds/order.wav", buf);
console.log(`public/sounds/order.wav ${(buf.length / 1024).toFixed(0)} KB, ${total.toFixed(2)} s`);
