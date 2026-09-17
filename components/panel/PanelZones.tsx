"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@/lib/i18n";
import type { Settings } from "@/lib/settings";
import type { Zone } from "@/lib/zones";

interface Props {
  t: Messages["panel"];
  /** panel yetkisiyle istek atan yardımcı (PanelApp'ten) */
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onUnauthorized: () => void;
}

/** Yeni kayıt için id: addan türetilir, çakışırsa sonuna sayı eklenir. */
function slugify(name: string, taken: Set<string>): string {
  const base =
    name
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "bolge";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 999; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

type Draft = { id?: string; name: string; minCart: string; fee: string; etaMinutes: string };
const BOS: Draft = { name: "", minCart: "0", fee: "0", etaMinutes: "" };

/**
 * Teslimat bölgeleri yönetimi — ekle / düzenle / sil / geçici kapat / sırala.
 *
 * Veri settings.zones içinde (tekil satır, jsonb). Yazma YALNIZCA
 * /api/panel/settings PATCH üzerinden; şema sunucuda da doğrulanır
 * (lib/zones normalizeZones), yani buradaki alan kontrolleri kullanıcı
 * kolaylığı içindir, güvenlik sınırı değildir.
 *
 * id DEĞİŞMEZ: mevcut siparişlerin `zone` alanı bu id'ye bakıyor. Ad değişebilir,
 * id kalır — eski siparişlerin bölge adı bozulmasın.
 */
export default function PanelZones({ t, apiFetch, onUnauthorized }: Props) {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/panel/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Settings) => {
        if (alive) setZones(d.zones ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** Tek yazma noktası: listeyi olduğu gibi gönder, dönen kaydı doğru kabul et. */
  const save = async (next: Zone[]) => {
    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch("/api/panel/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ zones: next }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) {
        setErr(String(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.status));
        return false;
      }
      setZones(((await res.json()) as Settings).zones ?? []);
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (!zones) return <section className="pnl-box" aria-busy="true" />;

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const submit = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setErr(t.zoneNameRequired);
    const eta = draft.etaMinutes.trim() ? num(draft.etaMinutes) : undefined;
    let next: Zone[];
    if (draft.id) {
      /* düzenleme: id korunur */
      next = zones.map((z) => (z.id === draft.id ? { ...z, name, minCart: num(draft.minCart), fee: num(draft.fee), etaMinutes: eta } : z));
    } else {
      const id = slugify(name, new Set(zones.map((z) => z.id)));
      next = [...zones, { id, name, minCart: num(draft.minCart), fee: num(draft.fee), etaMinutes: eta, active: true }];
    }
    if (await save(next)) setDraft(null);
  };

  const toggle = (id: string) => save(zones.map((z) => (z.id === id ? { ...z, active: z.active === false } : z)));
  const remove = (z: Zone) => {
    if (!window.confirm(t.zoneDeleteSure.replace("{name}", z.name))) return;
    /* Son bölge silinemez: liste boşalırsa sunucu 422 döner (kaza ile tüm
       teslimatı kapatmayı engelliyor). Kapatmak için "Kapalı" anahtarı var. */
    void save(zones.filter((x) => x.id !== z.id));
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= zones.length) return;
    const next = zones.slice();
    [next[i], next[j]] = [next[j], next[i]];
    void save(next);
  };

  return (
    <section className="pnl-box" data-zones>
      <h2 className="pnl-h">{t.zonesTitle}</h2>
      {err ? (
        <p className="zn-err" role="alert">
          {err}
        </p>
      ) : null}
      {zones.length === 0 ? <p className="text-dim">{t.zoneEmpty}</p> : null}

      <ul className="zn-list">
        {zones.map((z, i) => {
          const kapali = z.active === false;
          return (
            <li key={z.id} className={"zn-row" + (kapali ? " off" : "")} data-zone={z.id} data-active={!kapali}>
              <div className="zn-main">
                <b className="zn-name">{z.name}</b>
                <span className="zn-meta">
                  min ₺{z.minCart} · ₺{z.fee}
                  {z.etaMinutes ? ` · ${z.etaMinutes} dk` : ""}
                </span>
              </div>
              <div className="zn-acts">
                <button type="button" className="zn-b" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t.zoneUp}>
                  ↑
                </button>
                <button type="button" className="zn-b" disabled={busy || i === zones.length - 1} onClick={() => move(i, 1)} aria-label={t.zoneDown}>
                  ↓
                </button>
                <button
                  type="button"
                  className={"zn-b " + (kapali ? "danger" : "ok")}
                  disabled={busy}
                  data-zone-toggle
                  aria-pressed={!kapali}
                  onClick={() => toggle(z.id)}
                >
                  {kapali ? t.zoneClosed : t.zoneOpen}
                </button>
                <button
                  type="button"
                  className="zn-b"
                  disabled={busy}
                  data-zone-edit
                  onClick={() =>
                    setDraft({ id: z.id, name: z.name, minCart: String(z.minCart), fee: String(z.fee), etaMinutes: z.etaMinutes ? String(z.etaMinutes) : "" })
                  }
                >
                  {t.zoneEdit}
                </button>
                <button type="button" className="zn-b danger" disabled={busy} data-zone-del onClick={() => remove(z)}>
                  {t.zoneDelete}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {draft ? (
        <div className="zn-form" data-zone-form>
          <label>
            <span>{t.zoneName}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-zone-name autoFocus maxLength={60} />
          </label>
          <label>
            <span>{t.zoneMin}</span>
            <input type="number" min={0} value={draft.minCart} onChange={(e) => setDraft({ ...draft, minCart: e.target.value })} data-zone-min />
          </label>
          <label>
            <span>{t.zoneFee}</span>
            <input type="number" min={0} value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} data-zone-fee />
          </label>
          <label>
            <span>{t.zoneEta}</span>
            <input type="number" min={0} value={draft.etaMinutes} onChange={(e) => setDraft({ ...draft, etaMinutes: e.target.value })} data-zone-eta />
          </label>
          <div className="zn-acts">
            <button type="button" className="act primary" disabled={busy} data-zone-save onClick={submit}>
              {t.zoneSave}
            </button>
            <button type="button" className="zn-b" disabled={busy} onClick={() => { setDraft(null); setErr(""); }}>
              {t.zoneCancel}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="act primary" disabled={busy} data-zone-add onClick={() => { setDraft({ ...BOS }); setErr(""); }}>
          + {t.zoneAdd}
        </button>
      )}
    </section>
  );
}
