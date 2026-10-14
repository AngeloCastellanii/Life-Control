// Life Control — Service Worker (offline PWA + notificaciones)
const CACHE = 'life-control-v7';
const PLAN_CACHE = 'life-control-plan-v1';
const APP_SHELL = '/App/index.html';
const PLAN_URL = '/__lc-reminder-plan';
const PRECACHE = [
   '/',
   '/index.html',
   '/App/index.html',
   '/App/index.js',
   '/App/style.css',
   '/App/fetchCacheBust.js',
   '/App/styleVersion.js',
   '/manifest.json',
   '/routes.js',
   '/sliceConfig.json',
   '/Slice/Slice.js',
   '/Styles/tailwind.css',
   '/Styles/sliceStyles.css',
   '/Styles/lifeControlBase.css',
   '/Themes/Light.css',
   '/Themes/Wine.css',
   '/images/icon-192.png',
   '/images/icon-512.png',
   '/images/icon.svg',
   '/images/apple-touch-icon.png'
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#3f7359">
  <title>Life Control</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #d4dfd8; color: #1f2a24; }
    main { max-width: 22rem; padding: 1.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { margin: 0; line-height: 1.45; }
    button { margin-top: 1rem; border: 0; border-radius: 999px; padding: .6rem 1.1rem; background: #3f7359; color: #fff; font: inherit; }
  </style>
</head>
<body>
  <main>
    <h1>Life Control</h1>
    <p>Sin conexión. Abre la app al menos una vez con internet para usarla offline.</p>
    <button type="button" onclick="location.reload()">Reintentar</button>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
   event.waitUntil(
      (async () => {
         const cache = await caches.open(CACHE);
         const urls = new Set(PRECACHE);
         try {
            const response = await fetch('/precache-manifest.json', { cache: 'reload' });
            if (response.ok) {
               const list = await response.json();
               if (Array.isArray(list)) {
                  for (const url of list) {
                     if (typeof url === 'string' && url.startsWith('/')) {
                        urls.add(url);
                     }
                  }
               }
            }
         } catch {
            /* sin manifiesto se precachea el shell y luego las visitas */
         }
         const list = [...urls].filter((url) => url !== '/service-worker.js');
         for (let index = 0; index < list.length; index += 12) {
            await Promise.all(list.slice(index, index + 12).map((url) => cacheUrl(cache, url)));
         }
         await mirrorHtmlShell(cache);
         await self.skipWaiting();
      })()
   );
});

self.addEventListener('activate', (event) => {
   event.waitUntil(
      caches
         .keys()
         .then((keys) =>
            Promise.all(
               keys.filter((key) => key !== CACHE && key !== PLAN_CACHE).map((key) => caches.delete(key))
            )
         )
         .then(() => self.clients.claim())
   );
});

function pathnameOf(requestOrUrl) {
   try {
      const url = new URL(typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url, self.location.origin);
      return url.pathname || '/';
   } catch {
      return '/';
   }
}

function isHtmlRequest(request) {
   return request.mode === 'navigate' || request.destination === 'document';
}

function asStorable(response) {
   const headers = new Headers(response.headers);
   headers.delete('Pragma');
   headers.delete('Expires');
   headers.set('Cache-Control', 'public, max-age=604800');
   return new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers
   });
}

function offlineHtmlFallback() {
   return new Response(OFFLINE_HTML, {
      status: 200,
      headers: {
         'Content-Type': 'text/html; charset=utf-8',
         'Cache-Control': 'no-cache'
      }
   });
}

async function cacheUrl(cache, url) {
   try {
      const response = await fetch(url, { cache: 'reload' });
      if (!response || !response.ok) {
         return;
      }
      const path = pathnameOf(url);
      if (!path || path === '/service-worker.js') {
         return;
      }
      await cache.put(path, asStorable(response));
   } catch {
      /* un archivo que falte no debe tumbar el precache entero */
   }
}

async function mirrorHtmlShell(cache) {
   const shell =
      (await cache.match('/')) ||
      (await cache.match(APP_SHELL)) ||
      (await cache.match('/index.html'));
   if (!shell) {
      return;
   }
   await cache.put('/', shell.clone());
   await cache.put('/index.html', shell.clone());
   await cache.put(APP_SHELL, shell.clone());
}

async function storeHtmlShell(response) {
   if (!response || !response.ok) {
      return;
   }
   try {
      const cache = await caches.open(CACHE);
      const stored = asStorable(response);
      await cache.put('/', stored.clone());
      await cache.put('/index.html', stored.clone());
      await cache.put(APP_SHELL, stored.clone());
   } catch {
      /* ignore quota */
   }
}

async function putInCache(request, response) {
   if (!response || response.status !== 200) {
      return;
   }
   if (response.type !== 'basic' && response.type !== 'cors') {
      return;
   }
   try {
      const cache = await caches.open(CACHE);
      const path = pathnameOf(request);
      if (!path || path === '/service-worker.js') {
         return;
      }
      await cache.put(path, asStorable(response));
   } catch {
      /* ignore quota / opaque */
   }
}

async function matchCached(requestOrUrl) {
   const cache = await caches.open(CACHE);
   const path = typeof requestOrUrl === 'string' ? pathnameOf(requestOrUrl) : pathnameOf(requestOrUrl);
   const byPath = await cache.match(path);
   if (byPath) {
      return byPath;
   }
   if (typeof requestOrUrl !== 'string') {
      const exact = await cache.match(requestOrUrl);
      if (exact) {
         return exact;
      }
      return cache.match(requestOrUrl, { ignoreSearch: true, ignoreMethod: true });
   }
   return cache.match(path, { ignoreSearch: true, ignoreMethod: true });
}

async function refresh(request) {
   try {
      const response = await fetch(request);
      if (!response || !response.ok) {
         return response;
      }
      if (isHtmlRequest(request)) {
         await storeHtmlShell(response);
      } else if (response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
         await putInCache(request, response);
      }
      return response;
   } catch {
      return null;
   }
}

async function cachedNavigation() {
   return (
      (await matchCached('/')) ||
      (await matchCached(APP_SHELL)) ||
      (await matchCached('/index.html'))
   );
}

self.addEventListener('fetch', (event) => {
   const { request } = event;
   if (request.method !== 'GET') {
      return;
   }

   const url = new URL(request.url);

   if (url.origin !== self.location.origin) {
      return;
   }
   if (url.pathname.startsWith('/api/') || url.pathname === '/service-worker.js') {
      return;
   }

   if (isHtmlRequest(request)) {
      event.respondWith(
         (async () => {
            const cached = (await matchCached(request)) || (await cachedNavigation());
            if (cached) {
               event.waitUntil(refresh(request));
               return cached;
            }
            const fresh = await refresh(request);
            if (fresh && fresh.ok) {
               return fresh;
            }
            return (await cachedNavigation()) || offlineHtmlFallback();
         })()
      );
      return;
   }

   event.respondWith(
      (async () => {
         const cached = await matchCached(request);
         if (cached) {
            event.waitUntil(refresh(request));
            return cached;
         }
         const fresh = await refresh(request);
         if (fresh) {
            return fresh;
         }
         return new Response('', { status: 503, statusText: 'Offline' });
      })()
   );
});

async function readReminderPlan() {
   try {
      const cache = await caches.open(PLAN_CACHE);
      const response = await cache.match(PLAN_URL);
      if (!response) {
         return [];
      }
      const data = await response.json();
      return Array.isArray(data?.items) ? data.items : [];
   } catch {
      return [];
   }
}

async function writeReminderPlan(plan) {
   const cache = await caches.open(PLAN_CACHE);
   await cache.put(
      PLAN_URL,
      new Response(JSON.stringify(plan ?? { items: [] }), {
         headers: { 'Content-Type': 'application/json' }
      })
   );
}

function digestBody(items) {
   const titles = items.map((item) => item.title).filter(Boolean);
   if (titles.length === 1) {
      return `Oye, tienes pendiente ${titles[0]}.`;
   }
   if (titles.length === 2) {
      return `Oye, tienes pendientes: ${titles[0]} y ${titles[1]}.`;
   }
   const rest = titles.length - 2;
   return `Oye, tienes ${titles.length} actividades pendientes: ${titles[0]}, ${titles[1]} y ${rest} más.`;
}

let nextAlarm = 0;

function armAlarm(items) {
   if (nextAlarm) {
      clearTimeout(nextAlarm);
      nextAlarm = 0;
   }
   const now = Date.now();
   const upcoming = (items ?? [])
      .filter((item) => !item.shown && Number(item.at) > now)
      .sort((a, b) => a.at - b.at)[0];
   if (!upcoming) {
      return;
   }
   const delay = Math.max(0, Math.min(upcoming.at - now, 2147483647));
   nextAlarm = setTimeout(() => {
      flushDueReminders()
         .then(() => readReminderPlan())
         .then((plan) => armAlarm(plan))
         .catch(() => {});
   }, delay);
}

function notificationOptions(item) {
   return {
      body: item.body || '',
      tag: item.tag || item.id || 'lc-pending',
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      data: { route: item.route || '/', ids: item.id ? [item.id] : [] }
   };
}

async function flushDueReminders() {
   const items = await readReminderPlan();
   const now = Date.now();
   const due = items.filter((item) => Number(item.at) <= now && !item.shown);
   if (due.length === 0) {
      armAlarm(items);
      return;
   }

   for (const item of due) {
      await self.registration.showNotification(item.title || 'Life Control', notificationOptions(item));
   }

   const shownIds = new Set(due.map((item) => item.id));
   const next = items.map((item) => (shownIds.has(item.id) ? { ...item, shown: true } : item));
   await writeReminderPlan({ items: next });
   armAlarm(next);
}

self.addEventListener('periodicsync', (event) => {
   if (event.tag === 'lc-reminders') {
      event.waitUntil(flushDueReminders());
   }
});

self.addEventListener('message', (event) => {
   const data = event.data;
   if (!data || typeof data !== 'object') {
      return;
   }

   if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
      event.waitUntil(
         (async () => {
            const cache = await caches.open(CACHE);
            await Promise.all(
               data.urls
                  .filter((url) => typeof url === 'string' && url.startsWith(self.location.origin))
                  .map((url) => cacheUrl(cache, url))
            );
            await mirrorHtmlShell(cache);
         })()
      );
   }

   if (data.type === 'SET_REMINDER_PLAN') {
      event.waitUntil(
         writeReminderPlan(data.plan).then(() => {
            const items = Array.isArray(data.plan?.items) ? data.plan.items : [];
            armAlarm(items);
         })
      );
   }

   if (data.type === 'FLUSH_REMINDERS') {
      event.waitUntil(flushDueReminders());
   }

   if (data.type === 'SHOW_NOTIFICATION') {
      event.waitUntil(
         self.registration.showNotification(
            data.title || 'Life Control',
            notificationOptions({
               body: data.body || '',
               tag: data.tag || 'lc-pending-digest',
               route: data.route || '/'
            })
         )
      );
   }
});

self.addEventListener('notificationclick', (event) => {
   event.notification.close();
   const route = event.notification?.data?.route || '/';
   event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
         for (const client of clients) {
            if ('focus' in client) {
               client.postMessage({ type: 'NAVIGATE', route });
               return client.focus();
            }
         }
         if (self.clients.openWindow) {
            return self.clients.openWindow(route);
         }
         return undefined;
      })
   );
});
