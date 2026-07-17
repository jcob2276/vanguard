import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Activate a freshly deployed app immediately instead of leaving the installed
// PWA on the previous precache until Android happens to terminate every client.
self.skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precaching assets automatically injected by Vite PWA
precacheAndRoute(self.__WB_MANIFEST);

// Handle push notifications
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Vanguard';
    const options = {
      body: data.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.tag || 'vanguard-notification',
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Failed to show push notification:', err);
  }
});

// Handle notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus if window already open
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
