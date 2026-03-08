/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// ── Precache all built assets (manifest injected by vite-plugin-pwa) ─────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime caching ────────────────────────────────────────────────────────────

// Google Fonts CSS — cache-first, 1 year
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-css',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31_536_000 }),
    ],
  })
);

// Google Fonts files — cache-first, 1 year
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 31_536_000 }),
    ],
  })
);

// BMW CDN fonts — cache-first, 1 year
registerRoute(
  ({ url }) => url.hostname === 'www.bmwusa.com' && url.pathname.endsWith('.woff2'),
  new CacheFirst({
    cacheName: 'bmw-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31_536_000 }),
    ],
  })
);

// Open-Meteo weather API — network-first, 30 min TTL
registerRoute(
  ({ url }) => url.hostname === 'api.open-meteo.com',
  new NetworkFirst({
    cacheName: 'weather-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 1_800 }),
    ],
  })
);

// ── Share Target handler ────────────────────────────────────────────────────────
// Intercepts POST /apex-lab/ from the Web Share Target API.
// Saves the shared file to IndexedDB so the app can pick it up on next render.
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === 'POST' &&
    (url.pathname === '/apex-lab/' || url.pathname === '/m3-dashboard')
  ) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('session') as File[];
          if (files.length > 0) {
            const file = files[0];
            const text = await file.text();
            // Store in apex-lab-v1 IDB using the same pattern as db.ts
            await storeSharePending(file.name, text);
          }
        } catch { /* ignore parse errors */ }
        return Response.redirect('/apex-lab/?shared=1', 303);
      })()
    );
  }
});

// Minimal IDB helper for the SW context (mirrors db.ts pattern)
function openApexDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('apex-lab-v1', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('sessions')) {
        req.result.createObjectStore('sessions');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeSharePending(filename: string, text: string): Promise<void> {
  const db = await openApexDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put({ filename, text }, 'share:pending');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Web Push ───────────────────────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() as { title?: string; body?: string } | undefined;
  event.waitUntil(
    self.registration.showNotification(data?.title ?? 'JP Apex Lab', {
      body: data?.body ?? 'You have new activity data.',
      icon: '/apex-lab/icons/icon-192.png',
      badge: '/apex-lab/icons/icon-192.png',
      tag: 'apex-push',
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        const existing = windowClients.find(c => c.url.includes('/apex-lab/'));
        if (existing) return existing.focus();
        return self.clients.openWindow('/apex-lab/');
      })
  );
});
