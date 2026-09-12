"use client";

import type { Messages } from "@/lib/i18n";
import { useClockMinute } from "@/lib/useClock";
import { groupedHours, isOpen, nextOpeningLabel, todayRangeLabel, istanbulNow } from "@/lib/hours";

/**
 * Çalışma saatleri bloğu — İLETİŞİM katmanı ve footer aynı bileşeni kullanır.
 * Veri lib/hours.ts'ten (tek kaynak); burada saat/gün SABİTİ YOK.
 *
 * "Şu an açık / kapalı" istemci tarafında hesaplanır: useClockMinute dakikada bir
 * tetikler, sunucuda −1 döner. Sunucu render'ında durum YAZILMAZ (suppressHydrationWarning
 * yerine bilinçli olarak null bırakılır) — yoksa sunucu saatiyle istemci saati
 * ayrışıp hydration uyuşmazlığı çıkıyor.
 *
 * Gün adları messages.contact.weekdays'ten gelir (üç dil). Gruplama lib/hours
 * groupedHours() ile: aynı saatli ardışık günler tek satırda birleşir
 * (Pzt–Cmt 12:00–00:00 · Paz 16:00–23:00).
 */
export default function Hours({ t, variant = "rows" }: { t: Messages["contact"]; variant?: "rows" | "compact" }) {
  const minute = useClockMinute();
  /* minute < 0 → sunucu/hydration: durumu henüz bilmiyoruz, yazma. */
  const known = minute >= 0;
  const open = known ? isOpen() : null;
  const groups = groupedHours();
  const days = t.weekdays;
  const short = t.weekdaysShort;

  /** "Pzt–Cmt" / tek günse "Paz" */
  const label = (g: { days: number[] }) =>
    g.days.length === 1 ? days[g.days[0]] : `${short[g.days[0]]}${t.daysJoin}${short[g.days[g.days.length - 1]]}`;

  if (variant === "compact") {
    /* Footer: tek satır — bugünün aralığı + durum. */
    return (
      <div className="hrsCompact" data-hours-compact>
        <span data-hours-today>{known ? todayRangeLabel() : null}</span>
        {open === null ? null : (
          <b className={open ? "hrsOpen" : "hrsClosed"} data-hours-state={open ? "open" : "closed"}>
            {open ? t.openNow : t.closedNow}
          </b>
        )}
      </div>
    );
  }

  const todayIdx = known ? istanbulNow().day : -1;
  return (
    <div className="hrsList" data-hours-list>
      {groups.map((g) => (
        <div key={g.label + g.days.join()} className={"hrsRow" + (g.days.includes(todayIdx) ? " today" : "")} data-hours-row>
          <span>{label(g)}</span>
          <i>{g.label}</i>
        </div>
      ))}
      {open === null ? null : (
        <div className={"hrsState " + (open ? "hrsOpen" : "hrsClosed")} data-hours-state={open ? "open" : "closed"}>
          {open ? t.openNow : `${t.closedNow} · ${nextOpeningLabel()}`}
        </div>
      )}
    </div>
  );
}
