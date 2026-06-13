import { installFetchCacheBust } from './fetchCacheBust.js';

installFetchCacheBust();

import Slice from '/Slice/Slice.js';

async function bootstrapLifeControl() {
   slice.context.create('lifeControl', {
      domains: [],
      tasks: [],
      timeBlocks: [],
      finances: [],
      shopping: [],
      profile: { displayName: '' }
   });

   const storage = await slice.build('StorageService', { sliceId: 'storage-service', singleton: true });
   if (!storage) {
      throw new Error('No se pudo crear StorageService');
   }
   await storage.init();

   const domainService = await slice.build('DomainService', { sliceId: 'domain-service', singleton: true });
   if (!domainService) {
      throw new Error('No se pudo crear DomainService');
   }
   await domainService.init();

   const taskService = await slice.build('TaskService', { sliceId: 'task-service', singleton: true });
   if (!taskService) {
      throw new Error('No se pudo crear TaskService');
   }
   await taskService.init();

   const exchangeRateService = await slice.build('ExchangeRateService', {
      sliceId: 'exchange-rate-service',
      singleton: true
   });
   if (!exchangeRateService) {
      throw new Error('No se pudo crear ExchangeRateService');
   }
   await exchangeRateService.init();

   const timeBlockService = await slice.build('TimeBlockService', {
      sliceId: 'time-block-service',
      singleton: true
   });
   if (!timeBlockService) {
      throw new Error('No se pudo crear TimeBlockService');
   }
   await timeBlockService.init();

   const financeService = await slice.build('FinanceService', { sliceId: 'finance-service', singleton: true });
   if (!financeService) {
      throw new Error('No se pudo crear FinanceService');
   }
   await financeService.init();

   const shoppingService = await slice.build('ShoppingService', { sliceId: 'shopping-service', singleton: true });
   if (!shoppingService) {
      throw new Error('No se pudo crear ShoppingService');
   }
   await shoppingService.init();

   const profileService = await slice.build('ProfileService', {
      sliceId: 'profile-service',
      singleton: true
   });
   if (!profileService) {
      throw new Error('No se pudo crear ProfileService');
   }
   await profileService.init();
}

slice.router.afterEach((to) => {
   document.title = `${to.metadata?.title ?? 'Life Control'} · Life Control`;
});

let bootstrapOk = false;

try {
   await bootstrapLifeControl();
   bootstrapOk = true;
} catch (error) {
   console.error('Error al iniciar Life Control:', error);
} finally {
   slice.loading?.stop();
}

if (bootstrapOk && !slice.router._started) {
   await slice.router.start();
}
