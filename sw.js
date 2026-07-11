/* RX.TRAINING service worker — Web Push + app icon badge.
   Deploy at the site root so its scope covers the whole app. */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'RX.TRAINING';
  const body  = data.body  || 'You have a new message';
  const badge = Number(data.badge || 0);
  const tag   = data.tag || 'rx-message';

  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body, tag, renotify: true,
      icon: '/icon-192.png', badge: '/icon-192.png',
      data: { url: data.url || '/' }
    });
    // Paint the unread count on the home-screen / app icon
    try {
      if (self.navigator && 'setAppBadge' in self.navigator) {
        if (badge > 0) await self.navigator.setAppBadge(badge);
        else await self.navigator.clearAppBadge();
      }
    } catch (e) {}
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
