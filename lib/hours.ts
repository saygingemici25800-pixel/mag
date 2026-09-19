/**
 * Çalışma saatleri — TEK KAYNAK. Saat dilimi Europe/Istanbul.
 *
 * 12 Eyl 2026 — İŞLETMEDEN ONAYLI, gün bazlı:
 *   Pazartesi–Cumartesi  12:00 – 00:00
 *   Pazar                16:00 – 23:00
 *
 * Önce tek bir OPEN_HOUR/CLOSE_HOUR çifti vardı (11:00–00:00, açılış "AÇIK" işaretliydi).
 * Artık gün bazlı: HOURS dizisi haftanın yedi gününü tutar (0 = Pazar, JS getDay ile aynı).
 *
 * GECE YARISI: kapanış "00:00" açılıştan KÜÇÜK göründüğü için (0 < 12) özel işlenir.
 * closeMin, gün başlangıcından itibaren DAKİKA cinsinden tutulur ve gece yarısını geçen
 * aralıkta 24 saati aşabilir: 12:00–00:00 → openMin 720, closeMin 1440.
 * Böylece 23:50 (1430) açık, 00:10 (10) kapalı olur — 00:10 artık bir SONRAKİ günün
 * penceresine bakar (Pazartesi 00:10, Pazar 16:00–23:00 penceresinin dışında).
 */
export const TZ = "Europe/Istanbul";

/** Bir günün penceresi. Dakika cinsinden, gün başından itibaren.
    closeMin > 1440 ise pencere gece yarısını geçiyor demektir. */
export interface DayHours {
  /** 0 = Pazar … 6 = Cumartesi (JS Date.getDay ile aynı) */
  day: number;
  /** açılış, gün başından dakika (12:00 → 720) */
  openMin: number;
  /** kapanış, gün başından dakika (00:00 → 1440, 23:00 → 1380) */
  closeMin: number;
}

const H = (h: number, m = 0) => h * 60 + m;

/** Gün bazlı çalışma saatleri — işletmeden onaylı (12 Eyl 2026). */
export const HOURS: readonly DayHours[] = [
  { day: 0, openMin: H(16), closeMin: H(23) }, // Pazar 16:00–23:00
  { day: 1, openMin: H(12), closeMin: H(24) }, // Pazartesi 12:00–00:00
  { day: 2, openMin: H(12), closeMin: H(24) },
  { day: 3, openMin: H(12), closeMin: H(24) },
  { day: 4, openMin: H(12), closeMin: H(24) },
  { day: 5, openMin: H(12), closeMin: H(24) },
  { day: 6, openMin: H(12), closeMin: H(24) }, // Cumartesi 12:00–00:00
] as const;

/**
 * ÖZEL GÜN (tatil/bayram): belirli bir TARİHTE haftalık programı ezer.
 * date "YYYY-MM-DD" — Istanbul takvim günü. closed:true ise o gün kapalı;
 * değilse openMin/closeMin o güne özel pencereyi verir (gece yarısını geçebilir).
 */
export interface SpecialDay {
  /** "YYYY-MM-DD" (Istanbul) */
  date: string;
  closed: boolean;
  openMin?: number;
  closeMin?: number;
  /** panelde görünen not (bayram adı vb.) — hesaba girmez */
  note?: string;
}

/** Panelden yönetilen program. Verilmezse koddaki HOURS + özel gün yok. */
export interface Schedule {
  week: readonly DayHours[];
  special: readonly SpecialDay[];
}

export const DEFAULT_SCHEDULE: Schedule = { week: HOURS, special: [] };

/** Bir günün penceresi — program verilmezse koddaki varsayılan. */
export const hoursFor = (day: number, sch?: Schedule | null): DayHours => {
  const w = sch?.week?.length === 7 ? sch.week : HOURS;
  return w[((day % 7) + 7) % 7];
};

/** Istanbul takvim günü "YYYY-MM-DD" (sunucunun saat diliminden BAĞIMSIZ). */
export function istanbulDateKey(now: Date, offsetDays = 0): string {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  /* en-CA biçimi zaten YYYY-MM-DD verir; timeZone ile Istanbul takvimine çevrilir. */
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** O tarihte özel gün var mı? */
export function specialFor(sch: Schedule | null | undefined, dateKey: string): SpecialDay | undefined {
  return sch?.special?.find((x) => x.date === dateKey);
}

/** Belirli bir TARİHİN geçerli penceresi: özel gün varsa o, yoksa haftalık program.
    Kapalı gün için openMin === closeMin döner (pencere yok). */
export function windowForDate(sch: Schedule | null | undefined, now: Date, offsetDays: number): DayHours {
  const key = istanbulDateKey(now, offsetDays);
  const sp = specialFor(sch, key);
  const day = (istanbulNow(now).day + offsetDays) % 7;
  const d = ((day % 7) + 7) % 7;
  if (sp) {
    if (sp.closed) return { day: d, openMin: 0, closeMin: 0 };
    if (typeof sp.openMin === "number" && typeof sp.closeMin === "number") return { day: d, openMin: sp.openMin, closeMin: sp.closeMin };
  }
  return hoursFor(d, sch);
}

/** "HH:MM" — 1440 (gece yarısı) "00:00" olarak yazılır. */
export function fmtMin(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Varsayılan "şimdi". Yalnızca sunucuda ve yalnızca test için: MAG_FAKE_NOW=2026-09-03T12:00:00+03:00
 *
 * 16 Eyl 2026: CANLIDA ASLA DİNLENMEZ. Yanlışlıkla production env'ine girerse
 * dükkânın açık/kapalı saati sahte zamana göre hesaplanır — kapalıyken sipariş
 * alınır ya da açıkken reddedilir. Bu yüzden VERCEL_ENV=production iken değer
 * görmezden gelinir ve bir kez uyarı basılır. */
let fakeNowWarned = false;
export function defaultNow(): Date {
  const fake = typeof process !== "undefined" ? process.env.MAG_FAKE_NOW : undefined;
  if (!fake) return new Date();
  const isProd = typeof process !== "undefined" && (process.env.VERCEL_ENV === "production" || process.env.MAG_ENV === "production");
  if (isProd) {
    if (!fakeNowWarned) {
      fakeNowWarned = true;
      console.error("[güvenlik] MAG_FAKE_NOW production ortamında tanımlı — YOK SAYILDI. Bu değişkeni production env'inden kaldırın.");
    }
    return new Date();
  }
  const d = new Date(fake);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Istanbul yerel saati: gün (0-6), saat, dakika ve gün başından dakika. */
export function istanbulNow(now: Date = defaultNow()): { day: number; hour: number; minute: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = get("hour") % 24; // en-US hour12:false bazı sürümlerde 24 verir
  const minute = get("minute");
  return { day: DAYS[wd] ?? 0, hour, minute, min: hour * 60 + minute };
}

/**
 * Şu an açık mı?
 * İki pencereye bakılır: BUGÜNÜN penceresi ve DÜNÜN gece yarısını geçen penceresi.
 * 00:10'da dünün penceresi (12:00–00:00 → 1440'ta biter) artık kapanmıştır, bugünün
 * penceresi de henüz açılmamıştır → kapalı. 23:50'de bugünün penceresi sürer → açık.
 */
export function isOpen(now: Date = defaultNow(), sch?: Schedule | null): boolean {
  const { min } = istanbulNow(now);
  // bugünün penceresi (özel gün varsa o ezer)
  const today = windowForDate(sch, now, 0);
  if (today.closeMin > today.openMin && min >= today.openMin && min < today.closeMin) return true;
  /* Dünün gece yarısını AŞAN penceresi bugüne sarkar (closeMin > 1440).
     Şu anki saatlerde bu dal çalışmaz: 12:00–00:00 tam gece yarısında biter
     (closeMin === 1440), yani 00:00 itibarıyla kapalıdır — doğrulandı:
     Cmt 23:59 açık, Paz 00:00 kapalı. Dal, kapanış 01:00'e çekilirse
     (closeMin 1500) hazır olsun diye duruyor. */
  const y = windowForDate(sch, now, -1);
  if (y.closeMin > 1440 && min < y.closeMin - 1440) return true;
  return false;
}

/** Bir sonraki açılış: { day, min, todayTomorrow } — gün adı çağıran tarafta çevrilir. */
export function nextOpening(now: Date = defaultNow(), sch?: Schedule | null): { day: number; min: number; daysAhead: number } {
  const { day, min } = istanbulNow(now);
  // bugün henüz açılmadıysa bugün (özel gün kapalıysa bugün atlanır)
  const today = windowForDate(sch, now, 0);
  if (today.closeMin > today.openMin && min < today.openMin) return { day, min: today.openMin, daysAhead: 0 };
  /* Bugünün açılışı geçtiyse sonraki günlere bakılır. Şu an her gün açık, yani ilk
     aday yarındır; ama bir gün TAMAMEN kapatılırsa (openMin === closeMin) atlanması
     gerekir — döngü bu yüzden gerçekten arar, ilk turda dönmez. */
  /* 14 gün ileri bakılır: arka arkaya özel-gün kapanışları olabilir. */
  for (let i = 1; i <= 14; i++) {
    const h = windowForDate(sch, now, i);
    if (h.closeMin > h.openMin) return { day: (day + i) % 7, min: h.openMin, daysAhead: i };
  }
  return { day, min: today.openMin, daysAhead: 0 };
}

/** "12:00" gibi — bir sonraki açılış saati. Arayüzde "yarın {open}'da açılıyoruz" için. */
export function nextOpeningLabel(now: Date = defaultNow(), sch?: Schedule | null): string {
  return fmtMin(nextOpening(now, sch).min);
}

/** Bugünün penceresi "12:00–00:00" biçiminde. */
export function todayRangeLabel(now: Date = defaultNow(), sch?: Schedule | null): string {
  const h = windowForDate(sch, now, 0);
  return `${fmtMin(h.openMin)}–${fmtMin(h.closeMin)}`;
}

/**
 * "simdi" + kapanışa kadar 30 dk'lık dilimler ("HH:MM"). Kapalıysa boş liste.
 * Gece yarısını geçen aralıkta son dilim 23:30'dur (kapanış 00:00).
 */
export function timeSlots(now: Date = defaultNow(), sch?: Schedule | null): string[] {
  if (!isOpen(now, sch)) return [];
  const { min } = istanbulNow(now);
  // hangi pencerenin içindeyiz: bugünün mü, dünün sarkanı mı?
  const today = windowForDate(sch, now, 0);
  const inToday = today.closeMin > today.openMin && min >= today.openMin && min < today.closeMin;
  const closeMin = inToday ? today.closeMin : windowForDate(sch, now, -1).closeMin - 1440;
  const slots: string[] = ["simdi"];
  // en erken dilim: şimdi + 30 dk, yarım saate yuvarlanmış
  let m = Math.ceil((min + 30) / 30) * 30;
  // kapanıştan 30 dk öncesine kadar dilim verilir (kapanışta teslim yok)
  for (; m <= closeMin - 30; m += 30) slots.push(fmtMin(m));
  return slots;
}

/** Haftanın günlerini arayüz sırasıyla verir: Pazartesi'den Pazar'a (TR okuma sırası). */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0] as const;

/** Ardışık aynı saatli günleri grupla: [{ days:[1..6], label:"12:00–00:00" }, { days:[0], … }] */
export function groupedHours(sch?: Schedule | null): { days: number[]; label: string; closed?: boolean }[] {
  const out: { days: number[]; label: string; closed?: boolean }[] = [];
  for (const d of WEEK_ORDER) {
    const h = hoursFor(d, sch);
    const kapali = h.closeMin <= h.openMin;
    const label = kapali ? "" : `${fmtMin(h.openMin)}–${fmtMin(h.closeMin)}`;
    const last = out.at(-1);
    if (last && last.label === label) last.days.push(d);
    else out.push({ days: [d], label, ...(kapali ? { closed: true } : {}) });
  }
  return out;
}

/** Geriye dönük uyum: eski tek-açılış etiketi bekleyen yerler için bir sonraki açılış. */
export const OPENS_AT_LABEL = fmtMin(hoursFor(1).openMin); // 12:00 (Pzt–Cmt)

/**
 * Arayüz için bir sonraki açılışın parçaları: saat + gün göreli adı.
 * relDay: 0 → "bugün", 1 → "yarın", 2+ → gerçek gün adı kullanılmalı (çağıran çevirir).
 * Şu an her gün açık olduğundan pratikte 0 veya 1 döner.
 */
export function nextOpeningParts(now: Date = defaultNow(), sch?: Schedule | null): { open: string; relDay: number; day: number } {
  const n = nextOpening(now, sch);
  return { open: fmtMin(n.min), relDay: n.daysAhead, day: n.day };
}
