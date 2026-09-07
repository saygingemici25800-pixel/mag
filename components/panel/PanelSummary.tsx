"use client";

import { useCallback, useEffect, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { formatPrice } from "@/lib/menu";

interface DaySummary {
  date: string;
  orders: number;
  revenue: number;
  topItem: { name: string; qty: number } | null;
  avgPrepMinutes: number | null;
  cancelled: number;
}

interface Props {
  t: Messages["panel"];
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onUnauthorized: () => void;
}

/** İstanbul saatiyle bugünün "YYYY-MM-DD" değeri (girdi alanının varsayılanı) */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Gün sonu özeti: sipariş sayısı, ciro, en çok satan, ortalama hazırlanma; tarih seçilebilir. */
export default function PanelSummary({ t, apiFetch, onUnauthorized }: Props) {
  const [date, setDate] = useState(today);
  const [d, setD] = useState<DaySummary | null>(null);

  const load = useCallback(
    async (day: string) => {
      const res = await apiFetch(`/api/panel/summary?date=${day}`);
      if (res.status === 401) return onUnauthorized();
      if (res.ok) setD((await res.json()) as DaySummary);
    },
    [apiFetch, onUnauthorized],
  );

  useEffect(() => {
    /* rAF: efekt gövdesinde senkron setState yerine bir kare sonra (cascading render uyarısı) */
    const raf = requestAnimationFrame(() => void load(date));
    return () => cancelAnimationFrame(raf);
  }, [date, load]);

  return (
    <section className="pnl-box" data-summary>
      <div className="sumhead">
        <h2 className="pnl-h">{t.summary}</h2>
        <label className="sumdate">
          <span className="sr-only">{t.sumDate}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-summary-date />
        </label>
      </div>
      {d ? (
        <dl className="sumgrid">
          <div>
            <dt>{t.sumOrders}</dt>
            <dd data-sum-orders>{d.orders}</dd>
          </div>
          <div>
            <dt>{t.sumRevenue}</dt>
            <dd data-sum-revenue>{formatPrice(d.revenue)}</dd>
          </div>
          <div>
            <dt>{t.sumTop}</dt>
            <dd data-sum-top>{d.topItem ? `${d.topItem.name} · ${d.topItem.qty}×` : "—"}</dd>
          </div>
          <div>
            <dt>{t.sumAvg}</dt>
            <dd data-sum-avg>{d.avgPrepMinutes !== null ? `${d.avgPrepMinutes} ${t.min}` : "—"}</dd>
          </div>
          <div>
            <dt>{t.sumCancelled}</dt>
            <dd data-sum-cancelled>{d.cancelled}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
