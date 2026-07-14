// Life Control — Service Worker (offline PWA)
// Estrategia: network-first para TODO el mismo origen (HTML y assets),
// con caché de respaldo solo cuando no hay red. Evita servir JS/CSS viejos
// tras un despliegue (causa de pantallas en blanco por código desincronizado).
const CACHE = 'life-control-v2';
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

   // Solo gestionamos mismo origen; APIs y terceros van directo a la red.
   if (url.origin !== self.location.origin) {
      return;
   }
   if (url.pathname.startsWith('/api/') || url.pathname === '/slice-env.json') {
      return;
   }

   // Network-first: siempre intentamos la red primero para tener el código al día.
   event.respondWith(
      fetch(request)
         .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
               const copy = response.clone();
               const cacheKey = isHtmlRequest(request) ? APP_SHELL : request;
               caches.open(CACHE).then((cache) => cache.put(cacheKey, copy)).catch(() => undefined);
            }
            return response;
         })
         .catch(() => {
            if (isHtmlRequest(request)) {
               return caches.match(APP_SHELL).then((cached) => cached ?? caches.match(request));
            }
            return caches.match(request);
         })
   );
});
