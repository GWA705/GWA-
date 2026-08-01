/* GWA Portal service worker — desktop push notifications. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'GWA Portal', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'GWA Portal';
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/staff' },
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/staff';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        // Focus an existing tab already on this deal/page if there is one.
        if (w.url.includes(target) && 'focus' in w) return w.focus();
      }
      for (const w of wins) {
        // Otherwise focus any open portal tab and navigate it.
        if ('focus' in w && 'navigate' in w) {
          w.focus();
          return w.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
