"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { MENU, type Category, type MenuItem } from "@/lib/menu";
import type { Settings } from "@/lib/settings";

interface Props {
  t: Messages["panel"];
  /** panel yetkisiyle istek atan yardımcı (PanelApp'ten) */
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onUnauthorized: () => void;
}

/** Tükendi işareti yalnızca sipariş edilebilir kalemler için anlamlı */
const CATS: Category[] = ["burger", "taco", "noodle", "yan", "sos", "icecek"];

/**
 * Panel ayarları: "sipariş açık/kapalı" anahtarı ve ürün/ek ürün "tükendi" işaretleri.
 * Durum sunucuda (lib/settings + /api/panel/settings); sayfa yenilense de kalır.
 */
export default function PanelSettings({ t, apiFetch, onUnauthorized }: Props) {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/panel/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Settings) => {
        if (alive) setS(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const patch = async (body: Partial<Pick<Settings, "ordering_open" | "sold_out">>) => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/panel/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) setS((await res.json()) as Settings);
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <section className="pnl-box" aria-busy="true" />;
  const isOut = (id: string) => s.sold_out.includes(id);
  const toggleOut = (id: string) => patch({ sold_out: isOut(id) ? s.sold_out.filter((x) => x !== id) : [...s.sold_out, id] });

  return (
    <section className="pnl-box" data-settings>
      <h2 className="pnl-h">{t.settings}</h2>

      {/* sipariş açık / kapalı — kapalıyken sitede sipariş verilemez */}
      <button
        type="button"
        className={"act " + (s.ordering_open ? "primary" : "danger")}
        disabled={busy}
        data-ordering-toggle
        aria-pressed={s.ordering_open}
        onClick={() => patch({ ordering_open: !s.ordering_open })}
      >
        {s.ordering_open ? `● ${t.orderingOpen}` : `○ ${t.orderingClosed}`}
      </button>

      {/* tükendi işaretleri */}
      <p className="pnl-hint">{t.soldOutHint}</p>
      <div className="soldgrid">
        {CATS.flatMap((c) => MENU[c].map((m: MenuItem) => ({ c, m }))).map(({ m }) => (
          <button
            key={m.id}
            type="button"
            className={"soldchip" + (isOut(m.id) ? " out" : "")}
            disabled={busy}
            data-sold-out={m.id}
            aria-pressed={isOut(m.id)}
            onClick={() => toggleOut(m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>
    </section>
  );
}
