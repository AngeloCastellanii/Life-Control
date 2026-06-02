import Slice from '/Slice/Slice.js';

if (slice.router?._autoStartTimeout) {
   clearTimeout(slice.router._autoStartTimeout);
   slice.router._autoStartTimeout = null;
}

async function bootstrapLifeControl() {
   slice.context.create('lifeControl', {
      domains: [],
      tasks: [],
      timeBlocks: [],
      finances: [],
      shopping: []
   });

   const storage = await slice.build('StorageService', { sliceId: 'storage-service' });
   await storage.init();

   const domainService = await slice.build('DomainService', { sliceId: 'domain-service' });
   await domainService.init();

   slice.router.afterEach((to) => {
      document.title = `${to.metadata?.title ?? 'Life Control'} · Life Control`;
   });
}

await bootstrapLifeControl();
await slice.router.start();
