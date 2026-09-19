import type { Messages } from "@/lib/i18n";
import { nextOpeningParts, todayRangeLabel, type Schedule } from "@/lib/hours";

/**
 * Sipariş arayüzündeki saat metinleri — TR/EN/RU aynı yerden kurulur.
 *
 * Neden burada: "yarın 12:00'de açılıyoruz" cümlesi üç dilde de gün adı + saat
 * istiyor ve gün adı göreli ("bugün"/"yarın") ya da gerçek gün olabiliyor.
 * İki sayfa (OrderPage, CheckoutPage) aynı cümleyi kuruyordu; ayrışmasın diye
 * tek fonksiyona alındı.
 */

/** {day} yerine gelecek kelime: 0 → bugün, 1 → yarın, 2+ → gerçek gün adı. */
function dayWord(t: Messages, relDay: number, day: number): string {
  if (relDay === 0) return t.order.today;
  if (relDay === 1) return t.order.tomorrow;
  return t.contact.weekdays[day];
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);

/** "Şu an kapalıyız — yarın 12:00'da açılıyoruz." */
export function closedLabel(t: Messages, now?: Date, sch?: Schedule | null): string {
  const n = nextOpeningParts(now, sch);
  return fill(t.order.closed, { open: n.open, day: dayWord(t, n.relDay, n.day) });
}

/** "Kapalı · yarın 12:00'da açılıyoruz" (kısa başlık) */
export function closedShortLabel(t: Messages, now?: Date, sch?: Schedule | null): string {
  const n = nextOpeningParts(now, sch);
  return fill(t.order.closedShort, { open: n.open, day: dayWord(t, n.relDay, n.day) });
}

/** "Bugün 12:00–00:00" — açıkken gösterilen bugünün aralığı. */
export function todayHoursLabel(t: Messages, now?: Date, sch?: Schedule | null): string {
  return fill(t.order.hours, { range: todayRangeLabel(now, sch) });
}
