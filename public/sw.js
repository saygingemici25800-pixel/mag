/* MAG panel — Web Push service worker */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "Yeni sipariş", body: "", url: "/panel", tag: undefined };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 400],
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/panel";
  /* 15 Eyl 2026: url artık "/panel#<siparis-id>" — HASH taşıyor.
     Önceden `new URL(c.url).pathname === url` karşılaştırılıyordu; hash'li url
     hiçbir zaman pathname'e eşit olmadığı için AÇIK panel sekmesi bulunamıyor,
     her tıklamada yeni pencere açılıyordu. Artık pathname'ler karşılaştırılıyor,
     açık sekme bulunursa hash oraya postMessage ile bildiriliyor. */
  const target = new URL(raw, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).pathname !== target.pathname || !("focus" in c)) continue;
        /* Sekme zaten açık: navigate() her tarayıcıda yok, o yüzden mesajla söyle.
           PanelApp bu mesajı alınca karta kaydırır. */
        if (target.hash) c.postMessage({ type: "mag-open-order", id: target.hash.slice(1) });
        return c.focus();
      }
      return self.clients.openWindow(target.pathname + target.hash);
    }),
  );
});
