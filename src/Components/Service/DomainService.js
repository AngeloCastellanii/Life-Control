const STORE = 'domains';

export default class DomainService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage?.db) {
         await this.storage.init();
      }
      await this.syncToContext();
   }

   async syncToContext() {
      const domains = await this.storage.getAll(STORE);
      domains.sort((a, b) => a.name.localeCompare(b.name));

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         domains
      }));
   }

   getAll() {
      return slice.context.getState('lifeControl')?.domains ?? [];
   }

   async create({ name, color }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const domain = {
         id: crypto.randomUUID(),
         name: trimmed,
         color: color || '#2563eb'
      };

      await this.storage.put(STORE, domain);
      await this.syncToContext();
      slice.events.emit('domain:changed', { action: 'create', domain });
      return domain;
   }

   async update(id, patch) {
      const domains = await this.storage.getAll(STORE);
      const existing = domains.find((d) => d.id === id);
      if (!existing) {
         return null;
      }

      const updated = {
         ...existing,
         ...patch,
         id,
         name: patch.name?.trim() ?? existing.name
      };

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('domain:changed', { action: 'update', domain: updated });
      return updated;
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('domain:changed', { action: 'delete', id });
      return true;
   }
}
