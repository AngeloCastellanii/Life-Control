import Slice from '/Slice/Slice.js';

async function bootstrapLifeControl() {
   slice.context.create('lifeControl', {
      domains: [],
      tasks: [],
      timeBlocks: [],
      finances: [],
      shopping: []
   });

   const storage = await slice.build('StorageService', { sliceId: 'storage-service' });
   if (!storage) {
      throw new Error('No se pudo crear StorageService');
   }
   await storage.init();

   const domainService = await slice.build('DomainService', { sliceId: 'domain-service' });
   if (!domainService) {
      throw new Error('No se pudo crear DomainService');
   }
   await domainService.init();

   const taskService = await slice.build('TaskService', { sliceId: 'task-service' });
   if (!taskService) {
      throw new Error('No se pudo crear TaskService');
   }
   await taskService.init();

   const exchangeRateService = await slice.build('ExchangeRateService', {
      sliceId: 'exchange-rate-service'
   });
   if (!exchangeRateService) {
      throw new Error('No se pudo crear ExchangeRateService');
   }
   await exchangeRateService.init();

   const timeBlockService = await slice.build('TimeBlockService', { sliceId: 'time-block-service' });
   if (!timeBlockService) {
      throw new Error('No se pudo crear TimeBlockService');
   }
   await timeBlockService.init();

   const financeService = await slice.build('FinanceService', { sliceId: 'finance-service' });
   if (!financeService) {
      throw new Error('No se pudo crear FinanceService');
   }
   await financeService.init();

   const shoppingService = await slice.build('ShoppingService', { sliceId: 'shopping-service' });
   if (!shoppingService) {
      throw new Error('No se pudo crear ShoppingService');
   }
   await shoppingService.init();
}

slice.router.afterEach((to) => {
   document.title = `${to.metadata?.title ?? 'Life Control'} · Life Control`;
});

try {
   await bootstrapLifeControl();
} catch (error) {
   console.error('Error al iniciar Life Control:', error);
} finally {
   if (!slice.router._started) {
      await slice.router.start();
   }
   slice.loading?.stop();
}
