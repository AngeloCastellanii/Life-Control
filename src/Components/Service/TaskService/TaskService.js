const STORE = 'tasks';

export const TASK_URGENCY = {
   HIGH: 'high',
   MEDIUM: 'medium',
   LOW: 'low'
};

export default class TaskService {
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
      const tasks = await this.storage.getAll(STORE);
      tasks.sort((a, b) => this.compareByUrgency(a, b));

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         tasks
      }));
   }

   compareByUrgency(a, b) {
      const order = { high: 0, medium: 1, low: 2 };
      const diff = (order[a.urgency] ?? 1) - (order[b.urgency] ?? 1);
      if (diff !== 0) {
         return diff;
      }
      return a.title.localeCompare(b.title);
   }

   getAll() {
      return slice.context.getState('lifeControl')?.tasks ?? [];
   }

   async create({ title, urgency, minutes, domainId, blockId = null }) {
      const trimmed = title?.trim();
      if (!trimmed || !domainId) {
         return null;
      }

      const task = {
         id: crypto.randomUUID(),
         title: trimmed,
         urgency: urgency || TASK_URGENCY.MEDIUM,
         minutes: Math.max(1, Number(minutes) || 30),
         domainId,
         blockId,
         completed: false
      };

      await this.storage.put(STORE, task);
      await this.syncToContext();
      slice.events.emit('task:changed', { action: 'create', task });
      return task;
   }

   async update(id, patch) {
      const tasks = await this.storage.getAll(STORE);
      const existing = tasks.find((t) => t.id === id);
      if (!existing) {
         return null;
      }

      const updated = {
         ...existing,
         ...patch,
         id,
         title: patch.title?.trim() ?? existing.title
      };

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('task:changed', { action: 'update', task: updated });
      return updated;
   }

   async toggleComplete(id, completed) {
      return this.update(id, { completed: !!completed });
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('task:changed', { action: 'delete', id });
      return true;
   }
}
