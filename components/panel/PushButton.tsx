"use client";

import { useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/env";
import type { Messages } from "@/lib/i18n";
import { apiFetch } from "@/lib/panel-client";

function urlB64ToU8(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Bildirimleri aç" → sw.js kaydı → PushManager.subscribe (VAPID) → POST /api/push/subscribe */
export default function PushButton({ t }: { t: Messages["panel"] }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "denied" | "unsupported" | "fail">("idle");

  const enable = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (!VAPID_PUBLIC_KEY) return setState("fail");
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
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

  const label =
    state === "ok" ? t.pushOk : state === "denied" ? t.pushDenied : state === "unsupported" ? t.pushUnsupported : state === "fail" ? t.pushFail : t.pushOn;
  return (
    <button type="button" className={"pill" + (state === "ok" ? " on" : "")} onClick={enable} disabled={state === "busy" || state === "ok"} data-push={state}>
      🔔 {label}
    </button>
  );
}
