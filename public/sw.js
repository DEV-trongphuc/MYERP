// MYERP Service Worker for PWA Omnibox Install & Desktop Push Notifications
const SW_VERSION = 'myerp-sw-v1792141955661';

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
  // 1. Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 2. Completely bypass Service Worker in local dev environment (localhost / 127.0.0.1)
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1'
  ) {
    return;
  }

  // 3. Never intercept backend API calls, action params, auth tokens, or chat streaming
  if (
    url.pathname.includes('/backend') ||
    url.pathname.includes('api.php') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/chat/') ||
    url.searchParams.has('action') ||
    url.searchParams.has('token')
  ) {
    return;
  }

  // 4. Never intercept Server-Sent Events (SSE) or long-lived streams
  const acceptHeader = event.request.headers.get('accept') || '';
  if (acceptHeader.includes('text/event-stream')) {
    return;
  }

  // 5. Never intercept version manifests, audio/video assets
  if (url.pathname.endsWith('version.json') || url.pathname.endsWith('.mp3')) {
    return;
  }

  // Directly fetch from live network - no stale offline cache
  event.respondWith(fetch(event.request));
});

// Push notification listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'MYERP ThÃƒÂ´ng BÃƒÂ¡o';
    const options = {
      body: data.body || 'BÃ¡ÂºÂ¡n cÃƒÂ³ thÃƒÂ´ng bÃƒÂ¡o mÃ¡Â»â€ºi tÃ¡Â»Â« hÃ¡Â»â€¡ thÃ¡Â»â€˜ng.',
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
      self.registration.showNotification('MYERP ThÃƒÂ´ng BÃƒÂ¡o', {
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
