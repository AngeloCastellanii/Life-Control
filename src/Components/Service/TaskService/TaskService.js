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

   getById(id) {
      return this.getAll().find((t) => t.id === id) ?? null;
   }

   async create({ title, urgency, minutes, domainId, blockId = null, startDate = null, dueDate = null, scheduledDate = null }) {
      const trimmed = title?.trim();
      if (!trimmed || !domainId) {
         return null;
      }

      const resolvedDue = dueDate || scheduledDate || null;
      const resolvedStart = startDate || resolvedDue || todayISO();

      const task = {
         id: crypto.randomUUID(),
         title: trimmed,
         urgency: urgency || TASK_URGENCY.MEDIUM,
         minutes: Math.max(1, Number(minutes) || 30),
         domainId,
         blockId,
         startDate: resolvedStart,
         dueDate: resolvedDue,
         scheduledDate: resolvedDue,
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
         title: patch.title?.trim() ?? existing.title,
         minutes: patch.minutes !== undefined ? Math.max(1, Number(patch.minutes) || 30) : existing.minutes,
         startDate: patch.startDate !== undefined ? patch.startDate || null : existing.startDate ?? null,
         dueDate: patch.dueDate !== undefined ? patch.dueDate || null : existing.dueDate ?? existing.scheduledDate ?? null,
         scheduledDate:
            patch.dueDate !== undefined
               ? patch.dueDate || null
               : patch.scheduledDate !== undefined
                 ? patch.scheduledDate || null
                 : existing.dueDate ?? existing.scheduledDate ?? null
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
      const tasks = await this.storage.getAll(STORE);
      const existing = tasks.find((t) => t.id === id);
      if (!existing) {
         return false;
      }

      if (existing.blockId) {
         const blocks = await this.storage.getAll('timeBlocks');
         const block = blocks.find((b) => b.id === existing.blockId);
         if (block) {
            await this.storage.put('timeBlocks', {
               ...block,
               taskIds: block.taskIds.filter((taskId) => taskId !== id)
            });
         }
      }

      await this.storage.delete(STORE, id);
      await this.syncToContext();

      const timeBlockService = slice.getComponent('time-block-service');
      if (existing.blockId && timeBlockService) {
         await timeBlockService.syncToContext();
         slice.events.emit('time-block:changed', { action: 'task-removed', id });
      }

      slice.events.emit('task:changed', { action: 'delete', id });
      return true;
   }
}
