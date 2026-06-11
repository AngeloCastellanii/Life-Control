export function domainForTask(domainId, domainService = null) {
   const service = domainService ?? slice.getComponent('domain-service');
   const fromService = service?.getById?.(domainId);
   const fromContext = slice.context.getState('lifeControl')?.domains?.find((d) => d.id === domainId);
   const domain = fromService ?? fromContext ?? null;

   return {
      id: domainId,
      name: domain?.name ?? 'Sin dominio',
      color: domain?.color ?? '#71717a'
   };
}
