import { installFetchCacheBust } from './fetchCacheBust.js';

installFetchCacheBust();

import Slice from '/Slice/Slice.js';

// Forzar tema fresco desde /Themes (sin CSS viejo en memoria/localStorage).
try {
   const themeName = localStorage.getItem('sliceTheme') || slice.theme || 'Light';
   slice.stylesManager?.themeManager?.themeStyles?.delete(themeName);
   localStorage.removeItem(`sliceTheme-${themeName}`);
   await slice.setTheme(themeName);
} catch (error) {
   console.warn('No se pudo refrescar el tema:', error);
}

/**
 * Inicializa un servicio de forma tolerante a fallos: si su init() lanza,
 * se registra el error pero NO se aborta el arranque de la app. Así un
 * servicio con problemas (p. ej. un store nuevo en una base de datos vieja)
 * nunca deja la pantalla en blanco.
 */
async function initService(name, sliceId) {
   try {
      const service = await slice.build(name, { sliceId, singleton: true });
      if (!service) {
         console.error(`No se pudo crear ${name}`);
         return null;
      }
      if (typeof service.init === 'function') {
         await service.init();
      }
      return service;
   } catch (error) {
      console.error(`Fallo al iniciar ${name}:`, error);
      return null;
   }
}

async function bootstrapLifeControl() {
   slice.context.create('lifeControl', {
      domains: [],
      tasks: [],
      timeBlocks: [],
      finances: [],
      paymentMethods: [],
      shopping: [],
      notes: [],
      vision: [],
      walletBalance: 0,
      profile: { displayName: '' }
   });

   // El almacenamiento es la base; se inicia primero (tolerante a fallos).
   await initService('StorageService', 'storage-service');

   await initService('DomainService', 'domain-service');
   await initService('TaskService', 'task-service');
   await initService('ExchangeRateService', 'exchange-rate-service');
   await initService('TimeBlockService', 'time-block-service');
   await initService('PaymentMethodService', 'payment-method-service');
   await initService('FinanceService', 'finance-service');
   await initService('ShoppingService', 'shopping-service');
   await initService('ProfileService', 'profile-service');
   await initService('NotesService', 'notes-service');
   await initService('VisionService', 'vision-service');
   await initService('ReminderService', 'reminder-service');
}

slice.router.afterEach((to) => {
   document.title = `${to.metadata?.title ?? 'Life Control'} · Life Control`;
});

try {
   await bootstrapLifeControl();
} catch (error) {
   console.error('Error al iniciar Life Control:', error);
} finally {
   slice.loading?.stop();
}

// Arrancamos el router SIEMPRE: aunque algún servicio haya fallado, la app
// se muestra (mejor una vista parcial que una pantalla en blanco).
if (!slice.router._started) {
   try {
      await slice.router.start();
   } catch (error) {
      console.error('Error al arrancar el router:', error);
   }
}

function collectCacheableUrls() {
   const urls = new Set();
   for (const el of document.querySelectorAll('script[src], link[href], img[src]')) {
      const url = el.src || el.href;
      if (url && url.startsWith(window.location.origin)) {
         urls.add(url);
      }
   }
   try {
      for (const entry of performance.getEntriesByType('resource')) {
         if (entry.name && entry.name.startsWith(window.location.origin)) {
            urls.add(entry.name);
         }
      }
   } catch {
      /* ignore */
   }
   return [...urls];
}

if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
      navigator.serviceWorker
         .register('/service-worker.js')
         .then(async (registration) => {
            await navigator.serviceWorker.ready;
            const worker = registration.active;
            worker?.postMessage({ type: 'CACHE_URLS', urls: collectCacheableUrls() });
            window.setTimeout(() => {
               worker?.postMessage({ type: 'CACHE_URLS', urls: collectCacheableUrls() });
            }, 2500);
         })
         .catch((error) => {
            console.warn('No se pudo registrar el Service Worker:', error);
         });
   });

   navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE' && event.data.route) {
         slice.router?.navigate?.(event.data.route);
      }
   });
}
