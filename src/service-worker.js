// Life Control — Service Worker (offline PWA)
// Estrategia: network-first para navegación/HTML, stale-while-revalidate para assets.
const CACHE = 'life-control-v1';
const APP_SHELL = '/App/index.html';
const PRECACHE = [
   '/App/index.html',
   '/manifest.json',
   '/images/icon-192.png',
   '/images/icon-512.png',
   '/images/icon.svg'
];

self.addEventListener('install', (event) => {
   event.waitUntil(
      caches
         .open(CACHE)
         .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
         .then(() => self.skipWaiting())
   );
});

self.addEventListener('activate', (event) => {
   event.waitUntil(
      caches
         .keys()
         .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
         .then(() => self.clients.claim())
   );
});

function isHtmlRequest(request) {
   return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

self.addEventListener('fetch', (event) => {
   const { request } = event;

   if (request.method !== 'GET') {
      return;
   }

   const url = new URL(request.url);

   // Solo cacheamos mismo origen; APIs y terceros van directo a la red.
   if (url.origin !== self.location.origin) {
      return;
   }
   if (url.pathname.startsWith('/api/') || url.pathname === '/slice-env.json') {
      return;
   }

   if (isHtmlRequest(request)) {
      event.respondWith(
         fetch(request)
            .then((response) => {
               const copy = response.clone();
               caches.open(CACHE).then((cache) => cache.put(APP_SHELL, copy)).catch(() => undefined);
               return response;
            })
            .catch(() => caches.match(APP_SHELL).then((cached) => cached ?? caches.match(request)))
      );
      return;
   }

   event.respondWith(
      caches.match(request).then((cached) => {
         const network = fetch(request)
            .then((response) => {
               if (response && response.status === 200) {
                  const copy = response.clone();
                  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
               }
               return response;
            })
            .catch(() => cached);
         return cached ?? network;
      })
   );
});
