// Life Control — Service Worker (offline PWA + notificaciones)
const CACHE = 'life-control-v4';
const PLAN_CACHE = 'life-control-plan-v1';
const APP_SHELL = '/App/index.html';
const PLAN_URL = '/__lc-reminder-plan';
const PRECACHE = [
   '/App/index.html',
   '/App/index.js',
   '/manifest.json',
   '/routes.js',
   '/sliceConfig.json',
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
         .then((keys) =>
            Promise.all(
               keys.filter((key) => key !== CACHE && key !== PLAN_CACHE).map((key) => caches.delete(key))
            )
         )
         .then(() => self.clients.claim())
   );
});

function isHtmlRequest(request) {
   return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

async function putInCache(cacheName, request, response) {
   if (!response || response.status !== 200) {
      return;
   }
   try {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
   } catch {
      /* ignore quota / opaque */
   }
}

async function matchCached(request, cacheName = CACHE) {
   const cache = await caches.open(cacheName);
   const exact = await cache.match(request);
   if (exact) {
      return exact;
   }
   return cache.match(request, { ignoreSearch: true, ignoreMethod: true });
}

async function networkFirst(request, cacheName = CACHE) {
   try {
      const response = await fetch(request);
      if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
         await putInCache(cacheName, isHtmlRequest(request) ? APP_SHELL : request, response);
      }
      return response;
   } catch (error) {
      const cached = await matchCached(isHtmlRequest(request) ? APP_SHELL : request, cacheName);
      if (cached) {
         return cached;
      }
      if (isHtmlRequest(request)) {
         const shell = await matchCached(APP_SHELL, cacheName);
         if (shell) {
            return shell;
         }
      }
      throw error;
   }
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
   if (url.pathname.startsWith('/api/')) {
      return;
   }

   event.respondWith(networkFirst(request, CACHE));
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

async function flushDueReminders() {
   const items = await readReminderPlan();
   const now = Date.now();
   const due = items.filter((item) => Number(item.at) <= now && !item.shown);
   if (due.length === 0) {
      return;
   }

   const title = due.length === 1 ? 'Life Control' : 'Life Control · pendientes';
   await self.registration.showNotification(title, {
      body: due.length === 1 ? due[0].body || digestBody(due) : digestBody(due),
      tag: 'lc-pending-digest',
      renotify: true,
      requireInteraction: true,
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      data: { route: due[0]?.route || '/', ids: due.map((item) => item.id) }
   });

   const shownIds = new Set(due.map((item) => item.id));
   await writeReminderPlan({
      items: items.map((item) => (shownIds.has(item.id) ? { ...item, shown: true } : item))
   });
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
         caches.open(CACHE).then((cache) =>
            Promise.all(
               data.urls
                  .filter((url) => typeof url === 'string' && url.startsWith(self.location.origin))
                  .map((url) => cache.add(url).catch(() => undefined))
            )
         )
      );
   }

   if (data.type === 'SET_REMINDER_PLAN') {
      event.waitUntil(writeReminderPlan(data.plan));
   }

   if (data.type === 'FLUSH_REMINDERS') {
      event.waitUntil(flushDueReminders());
   }

   if (data.type === 'SHOW_NOTIFICATION') {
      event.waitUntil(
         self.registration.showNotification(data.title || 'Life Control', {
            body: data.body || '',
            tag: data.tag || 'lc-pending-digest',
            renotify: Boolean(data.renotify),
            requireInteraction: true,
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            data: { route: data.route || '/' }
         })
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
