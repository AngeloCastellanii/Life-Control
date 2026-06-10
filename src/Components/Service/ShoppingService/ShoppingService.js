const STORE = 'shopping';

export const SHOPPING_FREQUENCY = {
   DAILY: 'daily',
   WEEKLY: 'weekly',
   MONTHLY: 'monthly',
   YEARLY: 'yearly'
};

const FREQUENCY_ORDER = {
   daily: 0,
   weekly: 1,
   monthly: 2,
   yearly: 3
};

export default class ShoppingService {
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
      const shopping = await this.storage.getAll(STORE);
      shopping.sort((a, b) => {
         const freqDiff = (FREQUENCY_ORDER[a.frequency] ?? 0) - (FREQUENCY_ORDER[b.frequency] ?? 0);
         if (freqDiff !== 0) {
            return freqDiff;
         }
         return a.name.localeCompare(b.name);
      });

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         shopping
      }));
   }

   getAll() {
      return slice.context.getState('lifeControl')?.shopping ?? [];
   }

   getById(id) {
      return this.getAll().find((item) => item.id === id) ?? null;
   }

   getByFrequency(frequency) {
      return this.getAll().filter((item) => item.frequency === frequency);
   }

   async create({ name, frequency }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const item = {
         id: crypto.randomUUID(),
         name: trimmed,
         frequency: FREQUENCY_ORDER[frequency] !== undefined ? frequency : SHOPPING_FREQUENCY.WEEKLY,
         checked: false
      };

      await this.storage.put(STORE, item);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'create', item });
      return item;
   }

   async toggleChecked(id, checked) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const updated = { ...existing, checked: !!checked };
      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'update', item: updated });
      return updated;
   }

   async update(id, { name, frequency }) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const updated = {
         ...existing,
         name: trimmed,
         frequency: FREQUENCY_ORDER[frequency] !== undefined ? frequency : existing.frequency
      };

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'update', item: updated });
      return updated;
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'delete', id });
      return true;
   }
}
