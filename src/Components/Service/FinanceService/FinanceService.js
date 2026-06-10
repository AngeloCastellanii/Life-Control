const STORE = 'finances';

export const FINANCE_TYPE = {
   PAY: 'pay',
   RECEIVE: 'receive'
};

export default class FinanceService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage) {
         throw new Error('StorageService no está disponible');
      }
      if (!this.storage.db) {
         await this.storage.init();
      }
      await this.syncToContext();
   }

   async syncToContext() {
      const finances = await this.storage.getAll(STORE);
      finances.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         finances
      }));
   }

   getAll() {
      return slice.context.getState('lifeControl')?.finances ?? [];
   }

   getByType(type) {
      return this.getAll().filter((item) => item.type === type);
   }

   pendingTotal(type) {
      return this.getByType(type)
         .filter((item) => !item.settled)
         .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
   }

   async create({ description, amount, type }) {
      const trimmed = description?.trim();
      const value = Number(amount);
      if (!trimmed || !Number.isFinite(value) || value <= 0) {
         return null;
      }

      const item = {
         id: crypto.randomUUID(),
         description: trimmed,
         amount: value,
         type: type === FINANCE_TYPE.RECEIVE ? FINANCE_TYPE.RECEIVE : FINANCE_TYPE.PAY,
         settled: false,
         createdAt: new Date().toISOString()
      };

      await this.storage.put(STORE, item);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'create', item });
      return item;
   }

   async toggleSettled(id, settled) {
      const items = await this.storage.getAll(STORE);
      const existing = items.find((item) => item.id === id);
      if (!existing) {
         return null;
      }

      const updated = { ...existing, settled: !!settled };
      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'update', item: updated });
      return updated;
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'delete', id });
      return true;
   }
}
