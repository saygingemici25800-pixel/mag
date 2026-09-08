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
/** Realtime kopukken yedek yoklama aralığı (spec: 15 sn) */
const POLL_FALLBACK_MS = 15_000;

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

      /* CANLI AKIŞ — SUPABASE REALTIME (+ yoklama yedeği)
         Panel girişi PANEL_KEY olarak kalır; Supabase Auth ekranı YOK. Sunucu, PANEL_KEY çerezi
         geçerliyken yalnızca realtime için kısa ömürlü role="authenticated" JWT imzalar
         (/api/panel/realtime-token). RLS'te authenticated SELECT açık, anon hâlâ hiçbir şey okuyamaz.

         Realtime kurulamazsa (token yok/501, WebSocket engelli, bağlantı koptu) 15 sn'de bir
         yoklamaya düşülür; bağlantı geri gelince TAM LİSTE tazelenir, arada kaçan sipariş kalmaz. */
      {
        let stopped = false;
        let pollTimer = 0;
        let refreshTimer = 0;
        let channel: ReturnType<NonNullable<ReturnType<typeof supabaseBrowser>>["channel"]> | null = null;
        let since = "";
        const stamp = (o: Order) =>
          [o.created_at, o.accepted_at, o.closed_at, o.cancelled_at].filter((x): x is string => typeof x === "string").sort().pop() ?? o.created_at;

        /** Tam ya da artımlı liste çek; realtime kopukluğunda telafi de bunu kullanır. */
        const fetchList = async (full: boolean) => {
          const url = full || !since ? "/api/orders?limit=300" : `/api/orders?limit=300&since=${encodeURIComponent(since)}`;
          const r = await apiFetch(url);
          if (r.status === 401) { setGate("login"); return false; }
          if (!r.ok) return false;
          const fresh = (await r.json()) as Order[];
          const newest = fresh.map(stamp).sort().pop();
          if (newest) since = new Date(new Date(newest).getTime() - 1_000).toISOString();
          for (const o of fresh) upsert(o, false);
          return true;
        };

        /* --- yoklama yedeği: yalnızca realtime yokken çalışır --- */
        const startPoll = () => {
          if (pollTimer || stopped) return;
          const tick = async () => {
            if (stopped) return;
            setLive(await fetchList(false));
            if (!stopped) pollTimer = window.setTimeout(tick, POLL_FALLBACK_MS);
          };
          pollTimer = window.setTimeout(tick, POLL_FALLBACK_MS);
        };
        const stopPoll = () => {
          window.clearTimeout(pollTimer);
          pollTimer = 0;
        };

        /* --- realtime --- */
        const connect = async () => {
          if (stopped) return;
          const sb = supabaseBrowser();
          if (!sb) return startPoll();
          let token: string | null = null;
          let ttl = 900;
          try {
            const r = await apiFetch("/api/panel/realtime-token");
            if (r.ok) {
              const j = (await r.json()) as { token: string; expiresIn: number };
              token = j.token;
              ttl = j.expiresIn;
            }
          } catch {
            /* ağ hatası → yoklama */
          }
          if (!token || stopped) return startPoll();

          /* Token yalnızca realtime kanalı için; REST istekleri hâlâ PANEL_KEY çerezinden geçer. */
          sb.realtime.setAuth(token);
          channel = sb
            .channel("panel-orders")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => upsert(p.new as Order, true))
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => upsert(p.new as Order, false))
            .subscribe((status) => {
              if (stopped) return;
              if (status === "SUBSCRIBED") {
                setLive(true);
                stopPoll();
                /* Bağlantı (yeniden) kuruldu: arada kaçan kayıt kalmasın diye TAM liste tazele. */
                void fetchList(true);
              } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                setLive(false);
                startPoll(); // kopuk süre boyunca yoklama devralır
              }
            });

          /* Token ömrünün yarısında tazele: oturum sessizce düşmesin. */
          refreshTimer = window.setTimeout(() => {
            void (async () => {
              try {
                const r = await apiFetch("/api/panel/realtime-token");
                if (r.ok) sb.realtime.setAuth(((await r.json()) as { token: string }).token);
              } catch {
                /* tazelenemezse abonelik düşer, yoklama devralır */
              }
              if (!stopped) connectRefresh();
            })();
          }, (ttl * 1000) / 2);
        };
        const connectRefresh = () => {
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void connect(), 60_000);
        };

        /* Sekme öne gelince tam tazeleme (uykuda kaçan kayıtlar) */
        const onVisible = () => {
          if (document.visibilityState !== "visible" || stopped) return;
          void fetchList(true);
        };
        document.addEventListener("visibilitychange", onVisible);

        void fetchList(true).then((ok) => {
          setLive(ok);
          void connect();
        });

        stop = () => {
          stopped = true;
          stopPoll();
          window.clearTimeout(refreshTimer);
          document.removeEventListener("visibilitychange", onVisible);
          const sb = supabaseBrowser();
          if (channel && sb) sb.removeChannel(channel);
        };
      }
    })().catch(() => setLive(false));
    return () => stop();
  }, [gate, store, upsert]);

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
