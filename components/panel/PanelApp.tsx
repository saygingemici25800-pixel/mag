"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { OPEN_STATUSES, type Order, type OrderStatus } from "@/lib/orders";
import { apiFetch } from "@/lib/panel-client";
import { isUnlocked, playOrderSound, setSoundPref, soundPref, unlockSound } from "@/lib/panel-sound";
import { supabaseBrowser } from "@/lib/supabase";
import OrderCard from "./OrderCard";
import PanelSettings from "./PanelSettings";
import PanelSummary from "./PanelSummary";
import PushButton from "./PushButton";
import "./panel.css";

const t = getMessages("tr").panel;
type Gate = "loading" | "login" | "closed" | "ok";
type Tab = "active" | "today" | "past" | "settings";
type Mode = "supabase" | "key" | "open";
const SEEN_KEY = "mag:panel-seen";
const REPEAT_MS = 20_000;
/* Yoklama aralıkları — Vercel Hobby kotasına göre seçildi (aşağıdaki hesap yorumda).
   Sekme önde: hızlı tepki. Arka planda: panel açık unutulsa da kota yanmasın.
   Dükkân kapalıyken sipariş gelmeyeceği için en seyrek. */
const POLL_ACTIVE_MS = 4_000;
const POLL_HIDDEN_MS = 30_000;
const POLL_CLOSED_MS = 60_000;

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* yok say */
  }
}
function istanbulDay(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}

/** /panel — giriş kapısı (Supabase Auth ya da PANEL_KEY), canlı akış (realtime ya da SSE), ses, push. */
export default function PanelApp() {
  const [gate, setGate] = useState<Gate>("loading");
  const [mode, setMode] = useState<Mode>("open");
  const [store, setStore] = useState<"stub" | "supabase">("stub");
  const [loginErr, setLoginErr] = useState(false);
  const [orders, setOrders] = useState<Map<string, Order>>(new Map());
  const [seen, setSeen] = useState<Set<string>>(loadSeen); // kartlar yüklenene dek görünmez → hydration farkı yok
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<Tab>("active");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sound, setSound] = useState<{ unlocked: boolean; on: boolean }>(() => ({
    unlocked: isUnlocked(),
    on: typeof window === "undefined" ? true : soundPref(),
  }));
  const unseenRef = useRef(0);
  /* Dükkân açık mı — yoklama aralığını belirler (kapalıyken 60 sn). Ayarlar ucundan beslenir. */
  const orderingOpenRef = useRef<boolean | null>(null);
  const ordersRef = useRef<Map<string, Order>>(new Map());
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  /* --- kapı --- */
  const checkGate = useCallback(async () => {
    const me = (await (await apiFetch("/api/panel/me")).json()) as { mode: Mode; authorized: boolean; store: "stub" | "supabase" };
    setMode(me.mode);
    setStore(me.store);
    if (me.authorized) return setGate("ok");
    if (me.mode === "supabase") return setGate("login");
    // key modu: sunucuda anahtar var mı bilmiyoruz; giriş dener, 401 alırsa "kapalı" der (üretimde anahtar yok)
    setGate("login");
  }, []);
  useEffect(() => {
    // kapı kontrolü ağdan gelir; ilk render'da senkron setState olmasın diye bir tık ertele
    const id = window.setTimeout(() => {
      checkGate().catch(() => setGate("login"));
    }, 0);
    return () => window.clearTimeout(id);
  }, [checkGate]);

  const loginKey = async (key: string) => {
    const res = await apiFetch("/api/panel/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });
    if (res.ok) {
      setLoginErr(false);
      setGate("ok");
    } else setLoginErr(true);
  };
  const loginSupabase = async (email: string, password: string) => {
    const sb = supabaseBrowser();
    if (!sb) return setLoginErr(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setLoginErr(true);
    else {
      setLoginErr(false);
      setGate("ok");
    }
  };
  const logout = async () => {
    if (mode === "supabase") await supabaseBrowser()?.auth.signOut();
    else await apiFetch("/api/panel/login", { method: "DELETE" });
    setGate("login");
    setOrders(new Map());
  };

  /* --- akış --- */
  const upsert = useCallback((o: Order, hint: boolean) => {
    if (o.payment_status !== "paid") return; // panel yalnızca ödenmişleri görür
    const isNew = hint || !ordersRef.current.has(o.id); // ödeme tamamlanınca gelen UPDATE de "yeni"dir
    setOrders((m) => {
      const next = new Map(m);
      next.set(o.id, o);
      return next;
    });
    if (isNew) {
      setFresh((f) => new Set(f).add(o.id));
      playOrderSound();
      window.setTimeout(() => setFresh((f) => {
        const n = new Set(f);
        n.delete(o.id);
        return n;
      }), 2000);
    }
  }, []);

  useEffect(() => {
    if (gate !== "ok") return;
    let stop = () => {};
    (async () => {
      const res = await apiFetch("/api/orders?limit=300");
      if (res.status === 401) return setGate("login");
      const list = (await res.json()) as Order[];
      setOrders(new Map(list.map((o) => [o.id, o])));

      /* CANLI AKIŞ — UYARLANABİLİR YOKLAMA
         Neden SSE değil: Vercel (Hobby) akışı hemen sonlandırıyor. Canlıda ölçüldü — /api/orders/stream
         `hello` olayını gönderip 0.7 sn içinde kapanıyor, panel hiç canlı olmuyordu (4 dk boyunca
         104 örneğin hepsinde live=false). Ayrıca SSE bağlantısı boyunca fonksiyon ayakta sayıldığı
         için bir gecelik açık panel Hobby'nin aylık kotasını tek başına aşıyordu.

         Yoklama aralığı duruma göre: sekme önde 4 sn · arka planda 30 sn · dükkân kapalıyken 60 sn.
         Her tur ?since ile yalnızca DEĞİŞENLERİ çeker; sekme uykudan dönerse aradaki tüm kayıtlar
         tek istekte telafi edilir (son görülen damgadan sonrası). */
      {
        let timer = 0;
        let stopped = false;
        /* Son görülen değişiklik damgası — SUNUCUNUN saatinden türetilir, tarayıcınınkinden değil.
           Neden: istemci saati sunucudan sapabilir (ve testte MAG_FAKE_NOW sabit bir tarih verir);
           tarayıcı damgası kullanılınca yeni kayıtlar "since" filtresine takılıp hiç görünmüyordu.
           Her turda gelen kayıtların en yeni damgası bir sonraki turun başlangıcı olur. */
        let since = "";
        let firstDone = false;
        /** Bir siparişin en son değişim anı (oluşturma ya da aşama damgası) */
        const stamp = (o: Order) =>
          [o.created_at, o.accepted_at, o.closed_at, o.cancelled_at].filter((x): x is string => typeof x === "string").sort().pop() ?? o.created_at;

        const intervalMs = () => {
          if (document.visibilityState !== "visible") return POLL_HIDDEN_MS;
          return orderingOpenRef.current === false ? POLL_CLOSED_MS : POLL_ACTIVE_MS;
        };

        /* Artımlı çekme her N turda bir TAM listeyle tazelenir. Neden: bir kaydın damgası
           "since" sınırının gerisinde kalabiliyor (sunucu saati farkı, sahte saat, geç yazılan
           aşama damgası) ve o kayıt artımlı turlarda hiç dönmüyor. Tam tur bunu telafi eder;
           maliyeti aynı istek sayısı, yalnızca yanıt biraz büyük. */
        let ticks = 0;
        const FULL_EVERY = 5;

        const tick = async () => {
          if (stopped) return;
          try {
            /* İlk tur ve her 5 turda bir tam liste; aradakiler artımlı. */
            const full = !firstDone || !since || ticks % FULL_EVERY === 0;
            ticks++;
            const url = full ? "/api/orders?limit=300" : `/api/orders?limit=300&since=${encodeURIComponent(since)}`;
            const r = await apiFetch(url);
            if (r.status === 401) return setGate("login");
            if (!r.ok) { setLive(false); return; }
            const fresh = (await r.json()) as Order[];
            /* Yeni sınır: gelen kayıtların en yeni damgası (1 sn geri — aynı saniyedeki kayıt kaçmasın).
               Hiç kayıt gelmediyse eski sınır korunur; böylece arada yazılan hiçbir sipariş atlanmaz. */
            const newest = fresh.map(stamp).sort().pop();
            if (newest) since = new Date(new Date(newest).getTime() - 1_000).toISOString();
            firstDone = true;
            setLive(true);
            for (const o of fresh) upsert(o, false);
          } catch {
            setLive(false);
          } finally {
            if (!stopped) timer = window.setTimeout(tick, intervalMs());
          }
        };

        /* Sekme öne gelince: hemen bir tur ve aralığı sıfırla */
        const onVisible = () => {
          if (document.visibilityState !== "visible" || stopped) return;
          window.clearTimeout(timer);
          void tick();
        };
        document.addEventListener("visibilitychange", onVisible);
        void tick();

        stop = () => {
          stopped = true;
          window.clearTimeout(timer);
          document.removeEventListener("visibilitychange", onVisible);
        };
      }
    })().catch(() => setLive(false));
    return () => stop();
  }, [gate, store, upsert]);

  /* Dükkân açık/kapalı durumunu yoklama aralığı için izle (ayarlar ucu herkese açık okuma) */
  useEffect(() => {
    if (gate !== "ok") return;
    let alive = true;
    const read = async () => {
      try {
        const r = await fetch("/api/panel/settings", { cache: "no-store" });
        if (r.ok && alive) orderingOpenRef.current = ((await r.json()) as { ordering_open?: boolean }).ordering_open ?? null;
      } catch {
        /* okunamazsa varsayılan aralık kullanılır */
      }
    };
    void read();
    const id = window.setInterval(read, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [gate]);

  /* --- görüldü / ses tekrarı --- */
  const unseenIds = useMemo(() => [...orders.values()].filter((o) => o.status === "received" && !seen.has(o.id)).map((o) => o.id), [orders, seen]);
  useEffect(() => {
    unseenRef.current = unseenIds.length;
  }, [unseenIds]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (unseenRef.current > 0) playOrderSound();
    }, REPEAT_MS);
    return () => window.clearInterval(id);
  }, []);
  const markSeen = (id: string) =>
    setSeen((s) => {
      const n = new Set(s).add(id);
      saveSeen(n);
      return n;
    });

  const setStatus = async (id: string, status: OrderStatus, reason?: string, prepMinutes?: number) => {
    setBusy(id);
    try {
      const res = await apiFetch(`/api/orders/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, reason, prep_minutes: prepMinutes }) });
      if (res.status === 401) return setGate("login");
      if (res.ok) {
        upsert((await res.json()) as Order, false);
        markSeen(id);
      }
    } finally {
      setBusy(null);
    }
  };

  const toggleSound = async () => {
    if (!sound.unlocked) {
      const ok = await unlockSound();
      setSoundPref(true);
      setSound({ unlocked: ok, on: true });
      return;
    }
    const on = !sound.on;
    setSoundPref(on);
    setSound({ unlocked: true, on });
  };

  /* --- sekmeler --- */
  const today = istanbulDay(new Date().toISOString());
  const all = useMemo(() => [...orders.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), [orders]);
  const lists: Record<Tab, Order[]> = {
    active: all.filter((o) => OPEN_STATUSES.includes(o.status)),
    today: all.filter((o) => istanbulDay(o.created_at) === today),
    past: all.filter((o) => !OPEN_STATUSES.includes(o.status)),
    settings: [],
  };

  if (gate === "loading") return <main className="login" />;
  if (gate === "login") return <Login mode={mode} error={loginErr} onKey={loginKey} onSupabase={loginSupabase} />;

  return (
    <main className="pnl">
      <header className="pnl-top">
        <div className="flex items-center gap-4">
          <span className="pnl-mark">
            mag<i>.</i>
          </span>
          <span className="ord-label">
            {t.title} · {t.store[store]}
          </span>
        </div>
        <div className="pnl-hud">
          <span className="pill" aria-live="polite" data-live={live}>
            <i className={"dot" + (live ? "" : " off")} /> {live ? t.live : t.offline}
          </span>
          <button type="button" className={"pill" + (sound.unlocked && sound.on ? " on" : "")} onClick={toggleSound} data-sound={sound.unlocked ? (sound.on ? "on" : "off") : "locked"}>
            {sound.unlocked ? (sound.on ? `🔊 ${t.soundIsOn}` : `🔇 ${t.soundIsOff}`) : `🔈 ${t.soundOn}`}
          </button>
          <PushButton t={t} />
          {mode !== "open" ? (
            <button type="button" className="pill" data-logout onClick={logout}>
              {t.logout}
            </button>
          ) : null}
        </div>
      </header>

      <div className="tabs" role="tablist">
        {(["active", "today", "past", "settings"] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t.tabs[k]}
            <b>{lists[k].length}</b>
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <>
          <PanelSummary t={t} apiFetch={apiFetch} onUnauthorized={() => setGate("login")} />
          <PanelSettings t={t} apiFetch={apiFetch} onUnauthorized={() => setGate("login")} />
        </>
      ) : lists[tab].length === 0 ? (
        <p className="text-dim">{t.empty}</p>
      ) : (
        <div className="feed">
          {lists[tab].map((o) => (
            <OrderCard
              key={o.id}
              t={t}
              order={o}
              unseen={unseenIds.includes(o.id)}
              fresh={fresh.has(o.id)}
              busy={busy === o.id}
              onSeen={() => markSeen(o.id)}
              onStatus={(st, r, prep) => setStatus(o.id, st, r, prep)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function Login({ mode, error, onKey, onSupabase }: { mode: Mode; error: boolean; onKey: (k: string) => void; onSupabase: (e: string, p: string) => void }) {
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  return (
    <main className="login">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "supabase") onSupabase(email, pw);
          else onKey(key);
        }}
      >
        <span className="pnl-mark">
          mag<i>.</i>
        </span>
        <span className="ord-label">
          {t.title} · {t.login}
        </span>
        {mode === "supabase" ? (
          <>
            <input type="email" placeholder={t.email} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder={t.password} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </>
        ) : (
          <input type="password" placeholder={t.key} autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} />
        )}
        {error ? <span className="err">{t.loginFail}</span> : null}
        <button type="submit" className="act primary">
          {t.enter}
        </button>
      </form>
    </main>
  );
}
