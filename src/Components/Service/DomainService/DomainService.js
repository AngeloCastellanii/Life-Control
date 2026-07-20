const STORE = 'domains';

export default class DomainService {
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

   getById(id) {
      if (!id) {
         return null;
      }
      return this.getAll().find((domain) => domain.id === id) ?? null;
   }

   getDefaultId() {
      return this.getAll()[0]?.id ?? null;
   }

   async create({ name, color, monthlyBudget = 0 }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const domain = {
         id: crypto.randomUUID(),
         name: trimmed,
         color: color || '#2563eb',
         monthlyBudget: Number(monthlyBudget) > 0 ? Number(monthlyBudget) : 0
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

      const trimmed = patch.name !== undefined ? patch.name?.trim() : existing.name;
      if (!trimmed) {
         return null;
      }

      const updated = {
         ...existing,
         name: trimmed,
         color: patch.color ?? existing.color,
         monthlyBudget:
            patch.monthlyBudget !== undefined
               ? Number(patch.monthlyBudget) > 0
                  ? Number(patch.monthlyBudget)
                  : 0
               : existing.monthlyBudget ?? 0,
         id
      };

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('domain:changed', { action: 'update', domain: updated });
      return updated;
   }

   async remove(id) {
      const domains = await this.storage.getAll(STORE);
      if (domains.length <= 1) {
         return false;
      }

      const fallback = domains.find((domain) => domain.id !== id);
      const taskService = slice.getComponent('task-service');
      const tasks = taskService?.getAll?.() ?? [];

      for (const task of tasks.filter((item) => item.domainId === id)) {
         if (fallback?.id) {
            await taskService.update(task.id, { domainId: fallback.id });
         }
      }

      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('domain:changed', { action: 'delete', id });
      return true;
   }
}
