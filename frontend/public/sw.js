/* Service worker — Web Push toasts for Wali Rapports */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title_ar: "إشعار", body_ar: event.data ? event.data.text() : "" };
  }

  const title = data.title_ar || data.title_fr || "إشعار";
  const body = data.body_ar || data.body_fr || "";
  const url = data.url || "/";
  const tag = data.tag || "wali-rapports";
  const message_key = data.message_key || null;
  const rapport_id =
    data.rapport_id != null && Number.isFinite(Number(data.rapport_id))
      ? Number(data.rapport_id)
      : null;

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        client.postMessage({
          type: "hub-counts-refresh",
          url,
          message_key,
          rapport_id,
        });
      }
      await self.registration.showNotification(title, {
        body,
        tag,
        data: {
          url,
          title_fr: data.title_fr,
          body_fr: data.body_fr,
          message_key,
          rapport_id,
        },
        dir: "rtl",
        lang: "ar",
        renotify: true,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          client.postMessage({ type: "navigate", url });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
