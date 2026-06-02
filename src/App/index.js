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
