// Release 11.09.2026: Berechnungen, mobile Bedienung und konsistenter Offline-Stand.
const CACHE_NAME = 'arbeitszeiten-pwa-v0.4.0';
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/ArbeitszeitIcon-180.png',
  './icons/ArbeitszeitIcon-192.png',
  './icons/ArbeitszeitIcon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, {cache:'reload'})))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('arbeitszeiten-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Serve one complete app version from its install-time cache. An update is
  // activated as a unit instead of mixing old scripts with newer markup.
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request, {ignoreSearch:true});
      if (cached) return cached;
      try { return await fetch(event.request); }
      catch {
        if (event.request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
