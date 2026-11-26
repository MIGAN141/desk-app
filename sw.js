// sw.js - STEP 10. No caching of data files (the app must never show stale numbers as fresh). Web push only if the app sits on the
// home screen and the owner allowed it (VAPID public key from /api/account; the private key stays on the server). Plan B: Telegram only.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification("Grok Bot", { body: String(d.body || "").slice(0, 160), icon: "icons/icon-192.png", data: { url: d.url || null }, tag: d.tag || undefined }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const u = e.notification.data && e.notification.data.url;           // the FOMO button: a link made by links.py on the server, https only
  e.waitUntil(u && /^https:\/\//i.test(u) ? self.clients.openWindow(u) : self.clients.openWindow("./"));
});
