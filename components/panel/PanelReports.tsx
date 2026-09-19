"use client";

import { useCallback, useEffect, useState } from "react";
import { istanbulDateKey, defaultNow } from "@/lib/hours";
import type { Messages } from "@/lib/i18n";
import type { Report } from "@/lib/reports";

interface Props {
  t: Messages["panel"];
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onUnauthorized: () => void;
}

type Kisayol = "today" | "yesterday" | "last7" | "month" | "lastMonth" | "custom";

/** Tarihi gün ekleyip "YYYY-MM-DD" döndür (İstanbul takvimi). */
function kaydir(gun: string, fark: number): string {
  const d = new Date(gun + "T12:00:00Z"); // öğlen: DST kaymasında gün atlamasın
  d.setUTCDate(d.getUTCDate() + fark);
  return d.toISOString().slice(0, 10);
}
/** Ayın ilk/son günü (İstanbul takvimi, "YYYY-MM-DD"). */
function aySinirlari(gun: string, ayFark = 0): [string, string] {
  const [y, m] = gun.split("-").map(Number);
  const bas = new Date(Date.UTC(y, m - 1 + ayFark, 1, 12));
  const son = new Date(Date.UTC(y, m + ayFark, 0, 12));
  return [bas.toISOString().slice(0, 10), son.toISOString().slice(0, 10)];
}

/**
 * Raporlar — geçmiş sipariş verisi.
 *
 * TOPLAMA SUNUCUDA: bu bileşen sipariş listesi İNDİRMEZ, yalnızca
 * /api/panel/reports'tan hazır özet alır (birkaç yüz bayt). Sipariş sayısı
 * büyüdükçe tarayıcı tarafı yavaşlamasın diye.
 *
 * Grafik kütüphanesi yok: günlük/saatlik kırılım CSS genişliğiyle çizilen
 * sade çubuklar. Bağımlılık eklemeye değmez.
 */
export default function PanelReports({ t, apiFetch, onUnauthorized }: Props) {
  const bugun = istanbulDateKey(defaultNow());
  const [from, setFrom] = useState(kaydir(bugun, -6));
  const [to, setTo] = useState(bugun);
  const [aktif, setAktif] = useState<Kisayol>("last7");
  const [rapor, setRapor] = useState<Report | null>(null);
  /* true başlar: ilk render doğrudan "yükleniyor" çizer, effect'te durum yazımı gerekmez */
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  const getir = useCallback(
    async (f: string, u: string) => {
      setBusy(true);
      setErr("");
      try {
        const res = await apiFetch(`/api/panel/reports?from=${f}&to=${u}`, { cache: "no-store" });
        if (res.status === 401) return onUnauthorized();
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
          setErr(b.detail || b.error || String(res.status));
          setRapor(null);
          return;
        }
        setRapor((await res.json()) as Report);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setRapor(null);
      } finally {
        setBusy(false);
      }
    },
    [apiFetch, onUnauthorized],
  );

  /* İlk yükleme: son 7 gün. getir() içinde setBusy(true) var; effect gövdesinden
     SENKRON çağrılsaydı "render-sonra-düzelt" olurdu (react-hooks/set-state-in-effect).
     busy zaten true başlatılıyor (yukarıda), bu yüzden burada yeni bir durum
     yazımı yok: istek mikro-görevde başlar, ilk render doğrudan "yükleniyor" çizer. */
  useEffect(() => {
    let iptal = false;
    void Promise.resolve().then(() => {
      if (!iptal) void getir(from, to);
    });
    return () => {
      iptal = true;
    };
    // yalnızca mount'ta; sonraki çağrılar kısayol/Getir ile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kisayol = (k: Kisayol) => {
    let f = from, u = to;
    if (k === "today") { f = bugun; u = bugun; }
    else if (k === "yesterday") { f = kaydir(bugun, -1); u = f; }
    else if (k === "last7") { f = kaydir(bugun, -6); u = bugun; }
    else if (k === "month") { [f, u] = aySinirlari(bugun, 0); u = u > bugun ? bugun : u; }
    else if (k === "lastMonth") { [f, u] = aySinirlari(bugun, -1); }
    setAktif(k);
    if (k !== "custom") { setFrom(f); setTo(u); void getir(f, u); }
  };

  const csvIndir = () => {
    /* apiFetch başlık ekliyor ama indirme için tarayıcının kendi isteği gerek;
       panel çerezi (mag_panel) zaten gönderiliyor. */
    window.open(`/api/panel/reports?from=${from}&to=${to}&format=csv`, "_blank");
  };

  const s = rapor?.summary;
  const ort = s && s.orders > 0 ? Math.round(s.revenue / s.orders) : 0;
  const oran = (n: number, top: number) => (top > 0 ? Math.round((n / top) * 100) : 0);
  const enCokGun = Math.max(1, ...(rapor?.daily ?? []).map((d) => d.orders));
  const enCokSaat = Math.max(1, ...(rapor?.hourly ?? []).map((h) => h.orders));

  const KISAYOLLAR: [Kisayol, string][] = [
    ["today", t.rToday], ["yesterday", t.rYesterday], ["last7", t.rLast7],
    ["month", t.rThisMonth], ["lastMonth", t.rLastMonth], ["custom", t.rCustom],
  ];

  return (
    <section className="pnl-box" data-reports>
      <h2 className="pnl-h">{t.reportsTitle}</h2>

      <div className="rp-shorts">
        {KISAYOLLAR.map(([k, ad]) => (
          <button key={k} type="button" className={"zn-b" + (aktif === k ? " ok" : "")} disabled={busy} aria-pressed={aktif === k} data-rp-short={k} onClick={() => kisayol(k)}>
            {ad}
          </button>
        ))}
      </div>

      {aktif === "custom" ? (
        <div className="rp-range" data-rp-custom>
          <label>
            <span>{t.rFrom}</span>
            <input type="date" value={from} max={to} disabled={busy} data-rp-from onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>{t.rTo}</span>
            <input type="date" value={to} min={from} max={bugun} disabled={busy} data-rp-to onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="act primary" disabled={busy || from > to} data-rp-apply onClick={() => getir(from, to)}>
            {t.rApply}
          </button>
        </div>
      ) : null}

      {err ? <p className="zn-err" role="alert" data-rp-err>{t.rError}: {err}</p> : null}
      {busy ? <p className="text-dim" data-rp-loading>{t.rLoading}</p> : null}

      {rapor && !busy ? (
        <>
          <p className="rp-span" data-rp-span>{rapor.from} → {rapor.to}</p>

          <div className="rp-cards">
            <div className="rp-card" data-rp-orders={s!.orders}>
              <b>{s!.orders}</b>
              <span>{t.rOrders}</span>
            </div>
            <div className="rp-card" data-rp-revenue={s!.revenue}>
              <b>₺{s!.revenue.toLocaleString("tr-TR")}</b>
              <span>{t.rRevenue}</span>
            </div>
            <div className="rp-card" data-rp-avg={ort}>
              <b>₺{ort.toLocaleString("tr-TR")}</b>
              <span>{t.rAvg}</span>
            </div>
            <div className="rp-card" data-rp-delivery={s!.delivery} data-rp-pickup={s!.pickup}>
              <b>{s!.delivery} / {s!.pickup}</b>
              <span>{t.rDelivery} / {t.rPickup}</span>
              <small>%{oran(s!.delivery, s!.orders)} · %{oran(s!.pickup, s!.orders)}</small>
            </div>
            <div className="rp-card danger" data-rp-cancelled={s!.cancelled}>
              <b>{s!.cancelled}</b>
              <span>{t.rCancelled}</span>
              <small>%{oran(s!.cancelled, s!.total_all)}</small>
            </div>
          </div>
          <p className="text-dim rp-note">{t.rCancelNote}</p>

          {s!.total_all === 0 ? (
            <p className="text-dim" data-rp-empty>{t.rNoData}</p>
          ) : (
            <>
              <h3 className="pr-cat">{t.rTopItems}</h3>
              <ol className="rp-items" data-rp-items>
                {rapor.items.map((u) => (
                  <li key={u.id} data-rp-item={u.id}>
                    <span className="rp-nm">{u.name}</span>
                    <span className="rp-qt">{u.qty} {t.rQty}</span>
                    <span className="rp-rv">₺{u.revenue.toLocaleString("tr-TR")}</span>
                  </li>
                ))}
              </ol>

              <h3 className="pr-cat">{t.rDaily}</h3>
              <ul className="rp-bars" data-rp-daily>
                {rapor.daily.map((d) => (
                  <li key={d.date} data-rp-day={d.date} data-orders={d.orders}>
                    <span className="rp-lb">{d.date.slice(5)}</span>
                    <span className="rp-bar"><i style={{ width: `${(d.orders / enCokGun) * 100}%` }} /></span>
                    <span className="rp-vl">{d.orders} · ₺{d.revenue.toLocaleString("tr-TR")}</span>
                  </li>
                ))}
              </ul>

              <h3 className="pr-cat">{t.rHourly}</h3>
              <ul className="rp-bars" data-rp-hourly>
                {rapor.hourly.map((h) => (
                  <li key={h.hour} data-rp-hour={h.hour} data-orders={h.orders}>
                    <span className="rp-lb">{String(h.hour).padStart(2, "0")}:00</span>
                    <span className="rp-bar"><i style={{ width: `${(h.orders / enCokSaat) * 100}%` }} /></span>
                    <span className="rp-vl">{h.orders}</span>
                  </li>
                ))}
              </ul>

              {rapor.zones.length ? (
                <>
                  <h3 className="pr-cat">{t.rZones}</h3>
                  <ul className="rp-items" data-rp-zones>
                    {rapor.zones.map((z) => (
                      <li key={z.zone} data-rp-zone={z.zone}>
                        <span className="rp-nm">{z.zone}</span>
                        <span className="rp-qt">{z.orders}</span>
                        <span className="rp-rv">₺{z.revenue.toLocaleString("tr-TR")}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}

          <div className="zn-acts">
            <button type="button" className="act primary" disabled={busy} data-rp-csv onClick={csvIndir}>
              {t.rCsv}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
