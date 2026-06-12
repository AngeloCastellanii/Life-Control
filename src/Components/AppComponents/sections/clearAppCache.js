/** Limpia caché del navegador/PWA y recarga. No borra IndexedDB (tus datos). */
export async function clearAppCacheAndReload() {
   if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
   }

   if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
   }

   const RouteClass = slice.controller?.classes?.get?.('Route');
   if (RouteClass?.componentCache) {
      RouteClass.componentCache = {};
   }

   const url = new URL(window.location.href);
   url.searchParams.set('_refresh', String(Date.now()));
   window.location.replace(url.pathname + url.search + url.hash);
}
