"use client";

import { useEffect, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/env";
import type { Messages } from "@/lib/i18n";
import { apiFetch } from "@/lib/panel-client";

function urlB64ToU8(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * iOS'ta (iPhone/iPad) Web Push YALNIZCA ana ekrana eklenmiş PWA'da çalışır.
 * Tarayıcı sekmesinde PushManager ya hiç yok ya da subscribe sessizce başarısız olur.
 * standalone: ana ekrandan açılmış mı?
 */
function iosNeedsInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  if (!isIos) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

/**
 * İzin gerçekten reddedilmiş mi?
 *
 * `Notification.permission` tek başına yetmiyor: bazı ortamlarda (gömülü web
 * görünümleri, otomasyon tarayıcıları) izin verilmiş olsa bile "denied" kalıyor.
 * Permissions API "granted"/"prompt" diyorsa kullanıcı KİLİTLENMEMELİ — aksi
 * halde buton pasif çizilir ve bildirim hiç açılamaz.
 */
async function permanentlyDenied(): Promise<boolean> {
  if (Notification.permission !== "denied") return false;
  try {
    const st = (await navigator.permissions?.query({ name: "notifications" as PermissionName }))?.state;
    if (st === "granted" || st === "prompt") return false;
  } catch {
    /* Permissions API yoksa Notification.permission'a güven */
  }
  return true;
}

type State = "idle" | "busy" | "ok" | "denied" | "unsupported" | "fail";

/**
 * "Bildirimleri aç" → sw.js kaydı → PushManager.subscribe (VAPID) → POST /api/push/subscribe
 * Açıkken "Bildirimler açık" gösterir ve KAPATMA seçeneği sunar (DELETE /api/push/subscribe).
 *
 * 15 Eyl 2026:
 *  - VAPID anahtarı yoksa buton HİÇ RENDER EDİLMEZ (özellik sessizce kapalı, hata yok).
 *  - Mevcut abonelik açılışta kontrol edilir; zaten aboneyse doğrudan "açık" durumu.
 *  - iOS'ta ana ekrana eklenmemişse butonun yanında kısa açıklama notu görünür.
 */
export default function PushButton({ t }: { t: Messages["panel"] }) {
  /* Başlangıç durumu SENKRON hesaplanır (effect içinde setState çağırmak
     cascading render'a yol açıyor — eslint react-hooks/set-state-in-effect).
     Sunucuda window yok; lazy initializer yalnızca istemcide çalışır. */
  const [state, setState] = useState<State>(() => {
    if (typeof window === "undefined") return "idle";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "idle";
  });
  /* iOS notu da senkron: lazy initializer istemcide bir kez hesaplar,
     effect içinde tekrar set etmeye gerek yok (cascading render olurdu). */
  const [iosNote] = useState(() => iosNeedsInstall());

  /* Açılışta: zaten abone miyiz? (sayfa yenilense de durum korunsun) */
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    /* state yalnızca ilk değerinde okunuyor; bağımlılığa eklemek effect'i
       her durum değişiminde yeniden koştururdu. */
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    let alive = true;
    (async () => {
      /* "denied" başlangıcı yanlış olabilir (bkz. permanentlyDenied): düzelt. */
      if (Notification.permission === "denied") {
        if (await permanentlyDenied()) return;
        if (alive) setState("idle");
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (alive && sub) setState("ok");
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (!VAPID_PUBLIC_KEY) return setState("fail");
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      /* requestPermission "denied" dese de Permissions API "granted" diyorsa devam et. */
      if (perm !== "granted" && (await permanentlyDenied())) return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      /* subscribe() SW etkinleşmeden çağrılırsa bazı tarayıcılarda hata veriyor */
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(VAPID_PUBLIC_KEY) as BufferSource }));
      const res = await apiFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? "ok" : "fail");
    } catch {
      setState("fail");
    }
  };

  /** Kapat: tarayıcı aboneliğini bırak + sunucudaki kaydı sil. */
  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("idle");
    } catch {
      setState("fail");
    }
  };

  /* VAPID yoksa özellik kapalı: buton görünmez, hata da yok. */
  if (!VAPID_PUBLIC_KEY) return null;

  const on = state === "ok";
  const label = on ? t.pushOk : state === "denied" ? t.pushDenied : state === "unsupported" ? t.pushUnsupported : state === "fail" ? t.pushFail : t.pushOn;

  return (
    <span className="pushWrap">
      <button
        type="button"
        className={"pill" + (on ? " on" : "")}
        onClick={on ? disable : enable}
        disabled={state === "busy" || state === "denied" || state === "unsupported"}
        data-push={state}
        title={on ? t.pushOff : undefined}
      >
        🔔 {label}
        {on ? <i className="pushOff"> · {t.pushOff}</i> : null}
      </button>
      {iosNote && !on ? (
        <small className="pushNote" data-push-ios>
          {t.pushIosNote}
        </small>
      ) : null}
    </span>
  );
}
