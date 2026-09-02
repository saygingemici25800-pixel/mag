"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasSupabaseClient } from "@/lib/env";
import { getMessages } from "@/lib/i18n";
import { OPEN_STATUSES, type Order, type OrderStatus } from "@/lib/orders";
import { apiFetch } from "@/lib/panel-client";
import { isUnlocked, playOrderSound, setSoundPref, soundPref, unlockSound } from "@/lib/panel-sound";
import { supabaseBrowser } from "@/lib/supabase";
import OrderCard from "./OrderCard";
import PushButton from "./PushButton";
import "./panel.css";

const t = getMessages("tr").panel;
type Gate = "loading" | "login" | "closed" | "ok";
type Tab = "active" | "today" | "past";
type Mode = "supabase" | "key" | "open";
const SEEN_KEY = "mag:panel-seen";
const REPEAT_MS = 20_000;

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

      if (hasSupabaseClient && store === "supabase") {
        const sb = supabaseBrowser()!;
        const ch = sb
          .channel("orders-feed")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => upsert(p.new as Order, true))
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => upsert(p.new as Order, false))
          .subscribe((s) => setLive(s === "SUBSCRIBED"));
        stop = () => {
          sb.removeChannel(ch);
        };
      } else {
        const es = new EventSource("/api/orders/stream");
        es.addEventListener("hello", () => setLive(true));
        es.addEventListener("order", (e) => {
          const ev = JSON.parse((e as MessageEvent).data) as { type: "insert" | "update"; order: Order };
          upsert(ev.order, ev.type === "insert");
        });
        es.onerror = () => setLive(false);
        stop = () => es.close();
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

  const setStatus = async (id: string, status: OrderStatus, reason?: string) => {
    setBusy(id);
    try {
      const res = await apiFetch(`/api/orders/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, reason }) });
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
            <button type="button" className="pill" onClick={logout}>
              {t.logout}
            </button>
          ) : null}
        </div>
      </header>

      <div className="tabs" role="tablist">
        {(["active", "today", "past"] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t.tabs[k]}
            <b>{lists[k].length}</b>
          </button>
        ))}
      </div>

      {lists[tab].length === 0 ? (
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
              onStatus={(s, r) => setStatus(o.id, s, r)}
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
