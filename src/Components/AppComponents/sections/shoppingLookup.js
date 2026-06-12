function resolveShoppingService(shoppingService = null) {
   if (shoppingService && typeof shoppingService.getById === 'function') {
      return shoppingService;
   }

   const service = slice.getComponent('shopping-service');
   if (service && typeof service.getById === 'function') {
      return service;
   }

   return null;
}

export function shoppingItemById(itemId, shoppingService = null) {
   if (!itemId) {
      return null;
   }

   const service = resolveShoppingService(shoppingService);
   const fromService = service?.getById?.(itemId);
   if (fromService) {
      return fromService;
   }

   const items = slice.context.getState('lifeControl')?.shopping ?? [];
   return items.find((item) => item.id === itemId) ?? null;
}
