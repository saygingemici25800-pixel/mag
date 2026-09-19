"use client";

import { useEffect, useState } from "react";
import { fmtMin, istanbulDateKey, type DayHours, type SpecialDay } from "@/lib/hours";
import type { Messages } from "@/lib/i18n";
import { parseHM, type Settings } from "@/lib/settings";

interface Props {
  t: Messages["panel"];
  /** gün adları kökteki messages.contact.weekdays'ten (panelde kopya tutulmuyor) */
  weekdays: Messages["contact"]["weekdays"];
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onUnauthorized: () => void;
}

/** Arayüz sırası: Pazartesi → Pazar (TR okuma sırası) */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type Row = { day: number; open: string; close: string; closed: boolean };
type SpecRow = { date: string; closed: boolean; open: string; close: string; note: string };

/**
 * Çalışma saatleri + özel günler (tatil/bayram) yönetimi.
 *
 * Veri settings.schedule: { week: DayHours[7], special: SpecialDay[] }.
 * Dakika cinsinden saklanır (12:00 → 720, gece yarısı kapanış → 1440) çünkü
 * gece yarısını geçen pencere ancak böyle temsil edilebiliyor: 12:00–00:00
 * aralığında kapanış açılıştan KÜÇÜK görünürdü.
 *
 * Doğrulama burada VE sunucuda (lib/settings normalizeSchedule): biçim "SS:DD",
 * kapanış açılıştan sonra — gece yarısı kapanışı "00:00" 1440 olarak okunduğu
 * için bu kuralı zaten sağlar.
 *
 * Geçmiş tarihli özel günler listede gösterilmez; sunucu da her yazmada ayıklar.
 */
export default function PanelHours({ t, weekdays, apiFetch, onUnauthorized }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [spec, setSpec] = useState<SpecRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/panel/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Settings) => {
        if (!alive) return;
        const w = d.schedule.week;
        setRows(
          ORDER.map((day) => {
            const h = w.find((x) => x.day === day) as DayHours;
            const kapali = h.closeMin <= h.openMin;
            return { day, closed: kapali, open: kapali ? "12:00" : fmtMin(h.openMin), close: kapali ? "00:00" : fmtMin(h.closeMin) };
          }),
        );
        setSpec(
          d.schedule.special.map((s: SpecialDay) => ({
            date: s.date,
            closed: s.closed,
            open: s.openMin != null ? fmtMin(s.openMin) : "12:00",
            close: s.closeMin != null ? fmtMin(s.closeMin) : "00:00",
            note: s.note ?? "",
          })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!rows) return <section className="pnl-box" aria-busy="true" />;

  /** "00:00" kapanışı GECE YARISI demektir → 1440. Açılışta 0 olarak kalır. */
  const closeMinOf = (v: string) => {
    const m = parseHM(v);
    return m === 0 ? 1440 : m;
  };
  const rowBad = (r: Row) => {
    if (r.closed) return false;
    const o = parseHM(r.open), c = closeMinOf(r.close);
    if (o === null || c === null) return "format";
    return c > o ? false : "order";
  };
  const specBad = (s: SpecRow) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return "format";
    if (s.closed) return false;
    const o = parseHM(s.open), c = closeMinOf(s.close);
    if (o === null || c === null) return "format";
    return c > o ? false : "order";
  };
  const hatalar = [...rows.map(rowBad), ...spec.map(specBad)].filter(Boolean) as string[];

  const kaydet = async () => {
    setErr("");
    setMsg("");
    if (hatalar.includes("format")) return setErr(t.hoursBadFormat);
    if (hatalar.includes("order")) return setErr(t.hoursInvalid);
    const week: DayHours[] = [];
    for (let d = 0; d < 7; d++) {
      const r = rows.find((x) => x.day === d)!;
      week.push(r.closed ? { day: d, openMin: 0, closeMin: 0 } : { day: d, openMin: parseHM(r.open)!, closeMin: closeMinOf(r.close)! });
    }
    const special: SpecialDay[] = spec.map((s) =>
      s.closed
        ? { date: s.date, closed: true, ...(s.note.trim() ? { note: s.note.trim() } : {}) }
        : { date: s.date, closed: false, openMin: parseHM(s.open)!, closeMin: closeMinOf(s.close)!, ...(s.note.trim() ? { note: s.note.trim() } : {}) },
    );
    setBusy(true);
    try {
      const res = await apiFetch("/api/panel/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schedule: { week, special } }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) return setErr(String(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.status));
      setMsg(t.hoursSaved);
      window.setTimeout(() => setMsg(""), 2500);
    } finally {
      setBusy(false);
    }
  };

  const bugun = istanbulDateKey(new Date());
  const setRow = (day: number, p: Partial<Row>) => setRows(rows.map((r) => (r.day === day ? { ...r, ...p } : r)));

  return (
    <section className="pnl-box" data-hours-panel>
      <h2 className="pnl-h">{t.hoursTitle}</h2>
      {err ? <p className="zn-err" role="alert" data-hours-err>{err}</p> : null}
      {msg ? <p className="pr-ok" role="status" data-hours-ok>✓ {msg}</p> : null}

      <ul className="hp-list">
        {rows.map((r) => {
          const bad = rowBad(r);
          return (
            <li key={r.day} className={"hp-row" + (r.closed ? " off" : "") + (bad ? " bad" : "")} data-hours-day={r.day}>
              <span className="hp-name">{weekdays[r.day]}</span>
              <button
                type="button"
                className={"zn-b " + (r.closed ? "danger" : "ok")}
                disabled={busy}
                data-day-toggle={r.day}
                aria-pressed={!r.closed}
                onClick={() => setRow(r.day, { closed: !r.closed })}
              >
                {r.closed ? t.hoursClosedLbl : t.hoursOpenLbl}
              </button>
              <span className="hp-times">
                <input value={r.open} disabled={busy || r.closed} aria-label={`${weekdays[r.day]} ${t.hoursFrom}`} data-day-open={r.day} onChange={(e) => setRow(r.day, { open: e.target.value })} />
                <b>–</b>
                <input value={r.close} disabled={busy || r.closed} aria-label={`${weekdays[r.day]} ${t.hoursTo}`} data-day-close={r.day} onChange={(e) => setRow(r.day, { close: e.target.value })} />
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="pr-cat" style={{ marginTop: 16 }}>{t.specialTitle}</h3>
      <p className="text-dim" style={{ fontSize: "0.72rem" }}>{t.specialPast}</p>
      {spec.length === 0 ? <p className="text-dim">{t.specialNone}</p> : null}
      <ul className="hp-list">
        {spec.map((s, i) => {
          const bad = specBad(s);
          return (
            <li key={i} className={"hp-row" + (bad ? " bad" : "")} data-special={s.date}>
              <input className="hp-date" type="date" value={s.date} min={bugun} disabled={busy} data-special-date={i} onChange={(e) => setSpec(spec.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
              <button type="button" className={"zn-b " + (s.closed ? "danger" : "ok")} disabled={busy} data-special-toggle={i} aria-pressed={s.closed} onClick={() => setSpec(spec.map((x, j) => (j === i ? { ...x, closed: !x.closed } : x)))}>
                {s.closed ? t.specialClosedAll : t.hoursOpenLbl}
              </button>
              {!s.closed ? (
                <span className="hp-times">
                  <input value={s.open} disabled={busy} aria-label={t.hoursFrom} onChange={(e) => setSpec(spec.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                  <b>–</b>
                  <input value={s.close} disabled={busy} aria-label={t.hoursTo} onChange={(e) => setSpec(spec.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
                </span>
              ) : null}
              <input className="hp-note" placeholder={t.specialNote} value={s.note} disabled={busy} maxLength={80} onChange={(e) => setSpec(spec.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
              <button type="button" className="zn-b danger" disabled={busy} data-special-del={i} onClick={() => setSpec(spec.filter((_, j) => j !== i))}>
                {t.specialDel}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="zn-acts">
        <button type="button" className="zn-b" disabled={busy} data-special-add onClick={() => setSpec([...spec, { date: bugun, closed: true, open: "12:00", close: "00:00", note: "" }])}>
          + {t.specialAdd}
        </button>
        <button type="button" className="act primary" disabled={busy || hatalar.length > 0} data-hours-save onClick={kaydet}>
          {t.hoursSave}
        </button>
      </div>
    </section>
  );
}
