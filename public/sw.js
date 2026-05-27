self.addEventListener('install', () => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Wymagane przez Chrome do instalacji PWA
  e.respondWith(fetch(e.request));
});
