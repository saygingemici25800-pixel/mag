/** Çalışma saatleri. Kapanış 00:00 biliniyor; açılış saati AÇIK (spec §11.2). Saat dilimi Europe/Istanbul. */
export const OPEN_HOUR = 11; // AÇIK
export const CLOSE_HOUR = 24; // 00:00
export const TZ = "Europe/Istanbul";

/** Varsayılan "şimdi". Yalnızca sunucuda ve yalnızca test için: MAG_FAKE_NOW=2026-09-03T12:00:00+03:00 */
export function defaultNow(): Date {
  const fake = typeof process !== "undefined" ? process.env.MAG_FAKE_NOW : undefined;
  return fake ? new Date(fake) : new Date();
}

export function istanbulNow(now: Date = defaultNow()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

export function isOpen(now: Date = defaultNow()): boolean {
  const { hour } = istanbulNow(now);
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

/** "simdi" + kapanışa kadar 30 dk'lık dilimler ("HH:MM"). Kapalıysa boş liste. */
export function timeSlots(now: Date = defaultNow()): string[] {
  if (!isOpen(now)) return [];
  const { hour, minute } = istanbulNow(now);
  const slots: string[] = ["simdi"];
  // en erken dilim: şimdi + 30 dk, yarım saate yuvarlanmış
  let m = hour * 60 + minute + 30;
  m = Math.ceil(m / 30) * 30;
  for (; m <= (CLOSE_HOUR - 1) * 60 + 30; m += 30) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

export const OPENS_AT_LABEL = `${String(OPEN_HOUR).padStart(2, "0")}:00`;
