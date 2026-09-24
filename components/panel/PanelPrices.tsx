"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { MENU, priceOf, type Category } from "@/lib/menu";
import type { Settings } from "@/lib/settings";

interface Props {
  t: Messages["panel"];
  /** kategori etiketleri kökteki messages.categories'ten gelir (panelde ayrı kopya tutulmuyor) */
  cats: Messages["categories"];
  /** panel yetkisiyle istek atan yardımcı (PanelApp'ten) */
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onUnauthorized: () => void;
}

const CATS: Category[] = ["burger", "taco", "noodle", "yan", "sos", "icecek"];

/** Geçerli fiyat: pozitif TAM SAYI. Boş, 0, negatif, ondalık ve harf geçersiz. */
function gecerli(v: string): boolean {
  if (!/^\d+$/.test(v.trim())) return false; // harf/ondalık/boş/negatif hepsi burada elenir
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

/**
 * Ürün fiyatları — kategoriye göre gruplu liste, TOPLU kaydet.
 *
 * Veri: settings.prices (ürün id → ₺). SEYREK harita: yalnızca DEĞİŞTİRİLEN
 * ürünler yazılır; koddaki fiyat (lib/menu.ts) silinmez, fallback olarak kalır.
 * Bir alan koddaki değere geri getirilirse haritadan ÇIKARILIR.
 *
 * Yazma yalnızca /api/panel/settings PATCH (PANEL_KEY + service_role) üzerinden;
 * şema sunucuda yeniden doğrulanır. Buradaki kontroller kullanıcı kolaylığıdır.
 *
 * Sipariş tutarı bu ekrandan ETKİLENMEZ: toplam her zaman sunucuda, istekteki
 * {id, qty} üzerinden yeniden hesaplanır (istemci fiyat/tutar göndermez).
 */
export default function PanelPrices({ t, cats, apiFetch, onUnauthorized }: Props) {
  const [saved, setSaved] = useState<Record<string, number> | null>(null);
  /** ekrandaki ham girişler: id → metin (doğrulama için metin tutulur) */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/panel/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Settings) => {
        if (!alive) return;
        setSaved(d.prices ?? {});
        const init: Record<string, string> = {};
        /* 20 Eyl 2026: fiyatı HENÜZ GİRİLMEMİŞ ürün (kodda price 0, ör. citir-tavuk)
           alana "0" olarak yazılıyordu; 0 geçersiz fiyat olduğu için KAYDET düğmesi
           kilitleniyor ve panelden HİÇBİR fiyat kaydedilemiyordu. Artık boş gelir:
           işletme fiyatı yazana kadar o alan "eksik", ama diğerleri kaydedilebilir. */
        for (const c of CATS) for (const m of MENU[c]) { const v = priceOf(m, d.prices); init[m.id] = v > 0 ? String(v) : ""; }
        setDraft(init);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* Kaydedilmemiş değişiklikle sekmeyi kapatmaya çalışınca tarayıcı uyarısı.
     (Tarayıcılar kendi metnini gösterir; preventDefault yeterli.) */
  const kirli =
    saved !== null &&
    Object.entries(draft).some(([id, v]) => {
      const m = CATS.flatMap((c) => MENU[c]).find((x) => x.id === id);
      if (!m) return false;
      const kayitli = priceOf(m, saved);
      return v.trim() !== (kayitli > 0 ? String(kayitli) : "");
    });
  useEffect(() => {
    if (!kirli) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [kirli]);

  if (!saved) return <section className="pnl-box" aria-busy="true" />;

  const all = CATS.flatMap((c) => MENU[c]);
  /* Boş alan YALNIZCA fiyatı hiç girilmemiş üründe (kodda price 0, ör. citir-tavuk)
     kabul edilir: o ürün "yakında" durumunda kalır, diğer fiyatlar kaydedilebilir.
     FİYATI OLAN bir ürünün alanını boşaltmak HATADIR — yoksa mevcut fiyat kazara
     silinebilirdi (testin koruduğu davranış: smooky boşaltılınca kaydet kilitlenir). */
  const fiyatsizId = new Set(all.filter((m) => m.price <= 0).map((m) => m.id));
  const bozuk = Object.entries(draft)
    .filter(([id, v]) => (v.trim() === "" ? !fiyatsizId.has(id) : !gecerli(v)))
    .map(([id]) => id);

  const kaydet = async () => {
    setErr("");
    setMsg("");
    if (bozuk.length) return setErr(t.priceInvalid);
    /* SEYREK harita: koddaki fiyata eşit olan alan haritaya YAZILMAZ (geri alınır). */
    const next: Record<string, number> = {};
    for (const m of all) {
      const ham = (draft[m.id] ?? "").trim();
      if (ham === "") continue; // fiyat girilmemiş: haritaya yazılmaz
      const n = Number(ham);
      if (n !== m.price) next[m.id] = n;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/panel/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        /* replace:true ŞART. Bu ekran SEYREK harita gönderir: fiyatı temizlenen
           ya da kod varsayılanına eşitlenen ürün haritaya HİÇ yazılmaz ve
           ezmesinin kalkması bu yokluktan anlaşılır. API'nin varsayılanı
           24 Eyl 2026'da birleştirmeye çevrildi (kısmi güncelleme tüm haritayı
           uçuruyordu); birleştirmede "yok" = "dokunma" demek olacağı için bu
           ekran fiyat SİLEMEZDİ. Tam liste gönderen tek yer burası. */
        /* allow_empty: harita BOŞ da olabilir — tüm fiyatlar kod varsayılanına
           eşitlenirse seyrek harita {} olur ve bu GEÇERLİ bir kayıttır
           ("hiçbir ezme yok"). Koruma kazara boşalmaya karşı; burada niyet açık. */
        body: JSON.stringify({ prices: next, replace: true, allow_empty: true }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string; fields?: string[] };
        setErr(b.fields?.length ? `${b.error}: ${b.fields.join(", ")}` : String(b.error ?? res.status));
        return;
      }
      const s = (await res.json()) as Settings;
      setSaved(s.prices ?? {});
      const sync: Record<string, string> = {};
      for (const m of all) { const v = priceOf(m, s.prices); sync[m.id] = v > 0 ? String(v) : ""; }
      setDraft(sync);
      setMsg(t.priceSaved);
      window.setTimeout(() => setMsg(""), 2500);
    } finally {
      setBusy(false);
    }
  };

  const geriAl = () => {
    const sync: Record<string, string> = {};
    for (const m of all) { const v = priceOf(m, saved); sync[m.id] = v > 0 ? String(v) : ""; }
    setDraft(sync);
    setErr("");
  };

  return (
    <section className="pnl-box" data-prices>
      <h2 className="pnl-h">{t.pricesTitle}</h2>
      {err ? (
        <p className="zn-err" role="alert" data-price-err>
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="pr-ok" role="status" data-price-ok>
          ✓ {msg}
        </p>
      ) : null}
      {kirli && !msg ? <p className="pr-dirty" data-price-dirty>{t.priceDirty}</p> : null}

      {CATS.map((c) => (
        <div key={c} className="pr-group">
          <h3 className="pr-cat">{cats[c]}</h3>
          <ul className="pr-list">
            {MENU[c].map((m) => {
              const v = draft[m.id] ?? "";
              const bad = !gecerli(v);
              const kayitli = priceOf(m, saved);
              const degisti = v.trim() !== (kayitli > 0 ? String(kayitli) : "");
              return (
                <li key={m.id} className={"pr-row" + (bad ? " bad" : "") + (degisti ? " dirty" : "")} data-price-row={m.id}>
                  <label className="pr-name" htmlFor={`pr-${m.id}`}>
                    {m.name}
                    {/* Panelden değiştirilmişse koddaki fiyatı da göster: işletme neyi
                        değiştirdiğini bilsin, gerekirse geri dönebilsin. */}
                    {saved[m.id] !== undefined ? <small className="pr-def">{t.priceDefault.replace("{n}", String(m.price))}</small> : null}
                  </label>
                  <span className="pr-in">
                    <input
                      id={`pr-${m.id}`}
                      type="text"
                      inputMode="numeric"
                      value={v}
                      aria-invalid={bad || undefined}
                      aria-label={m.name}
                      data-price-input={m.id}
                      onChange={(e) => setDraft({ ...draft, [m.id]: e.target.value })}
                    />
                    <b>₺</b>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="zn-acts">
        <button type="button" className="act primary" disabled={busy || !kirli || bozuk.length > 0} data-price-save onClick={kaydet}>
          {t.priceSave}
        </button>
        <button type="button" className="zn-b" disabled={busy || !kirli} data-price-reset onClick={geriAl}>
          {t.priceReset}
        </button>
      </div>
    </section>
  );
}
