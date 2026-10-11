// MYERP Service Worker for PWA Omnibox Install & Desktop Push Notifications
const SW_VERSION = 'myerp-sw-v1791692530476';

self.addEventListener('install', (event) => {
  // Force new service worker to activate immediately without waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Delete all existing caches on activation to prevent stale code
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((name) => caches.delete(name)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data.type === 'PURGE_CACHE')) {
    self.skipWaiting();
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))));
  }
});

// Pass-through fetch handler for Chrome/Edge PWA installability requirements
self.addEventListener('fetch', (event) => {
  // Never cache API calls, version probes, or mutations
  if (event.request.method !== 'GET') return;
  
  // Directly fetch from live network - no stale offline cache
  event.respondWith(fetch(event.request));
});

// Push notification listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'MYERP ThÃ´ng BÃ¡o';
    const options = {
      body: data.body || 'Báº¡n cÃ³ thÃ´ng bÃ¡o má»›i tá»« há»‡ thá»‘ng.',
      icon: '/LOGO.jpg',
      badge: '/LOGO.jpg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('MYERP ThÃ´ng BÃ¡o', {
        body: text,
        icon: '/LOGO.jpg'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
