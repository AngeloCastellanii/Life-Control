import { todayISO } from '../../AppComponents/sections/plannerDates.js';

const STORE = 'tasks';

export const TASK_URGENCY = {
   HIGH: 'high',
   MEDIUM: 'medium',
   LOW: 'low'
};

export const TASK_RECURRENCE = {
   NONE: 'none',
   DAILY: 'daily',
   WEEKLY: 'weekly',
   MONTHLY: 'monthly'
};

function addPeriodISO(iso, recurrence) {
   const d = new Date(`${iso}T12:00:00`);
   if (recurrence === TASK_RECURRENCE.DAILY) {
      d.setDate(d.getDate() + 1);
   } else if (recurrence === TASK_RECURRENCE.WEEKLY) {
      d.setDate(d.getDate() + 7);
   } else if (recurrence === TASK_RECURRENCE.MONTHLY) {
      d.setMonth(d.getMonth() + 1);
   } else {
      return iso;
   }
   return d.toISOString().slice(0, 10);
}

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

   async create({ title, urgency, minutes, domainId, blockId = null, startDate = null, dueDate = null, scheduledDate = null, slotStart = null, slotEnd = null, recurrence = TASK_RECURRENCE.NONE }) {
      const trimmed = title?.trim();
      if (!trimmed || !domainId) {
         return null;
      }

      const resolvedDue = dueDate || scheduledDate || null;
      const resolvedStart = startDate || resolvedDue || todayISO();
      const hasBlock = Boolean(blockId);

      const task = {
         id: crypto.randomUUID(),
         title: trimmed,
         urgency: urgency || TASK_URGENCY.MEDIUM,
         minutes: Math.max(1, Number(minutes) || 30),
         domainId,
         blockId: hasBlock ? blockId : null,
         slotStart: hasBlock ? slotStart || null : null,
         slotEnd: hasBlock ? slotEnd || null : null,
         startDate: resolvedStart,
         dueDate: resolvedDue,
         scheduledDate: resolvedDue,
         recurrence: recurrence || TASK_RECURRENCE.NONE,
         completed: false,
         dueNotified: false
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

      const nextBlockId = patch.blockId !== undefined ? patch.blockId || null : existing.blockId ?? null;
      const hasBlock = Boolean(nextBlockId);

      const updated = {
         ...existing,
         ...patch,
         id,
         title: patch.title?.trim() ?? existing.title,
         minutes: patch.minutes !== undefined ? Math.max(1, Number(patch.minutes) || 30) : existing.minutes,
         blockId: nextBlockId,
         slotStart:
            patch.slotStart !== undefined
               ? patch.slotStart || null
               : hasBlock
                 ? existing.slotStart ?? null
                 : null,
         slotEnd:
            patch.slotEnd !== undefined
               ? patch.slotEnd || null
               : hasBlock
                 ? existing.slotEnd ?? null
                 : null,
         startDate: patch.startDate !== undefined ? patch.startDate || null : existing.startDate ?? null,
         dueDate: patch.dueDate !== undefined ? patch.dueDate || null : existing.dueDate ?? existing.scheduledDate ?? null,
         scheduledDate:
            patch.dueDate !== undefined
               ? patch.dueDate || null
               : patch.scheduledDate !== undefined
                 ? patch.scheduledDate || null
                 : existing.dueDate ?? existing.scheduledDate ?? null
      };

      const nextDue = updated.dueDate ?? updated.scheduledDate;
      const prevDue = existing.dueDate ?? existing.scheduledDate;
      if (nextDue !== prevDue) {
         updated.dueNotified = false;
      }

      if (!updated.blockId) {
         updated.slotStart = null;
         updated.slotEnd = null;
      }

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('task:changed', { action: 'update', task: updated });
      return updated;
   }

   async toggleComplete(id, completed) {
      const willComplete = !!completed;
      const existing = this.getById(id);
      const patch = { completed: willComplete, completedAt: willComplete ? todayISO() : null };
      const updated = await this.update(id, patch);

      if (willComplete && existing?.recurrence && existing.recurrence !== TASK_RECURRENCE.NONE) {
         await this.spawnNextOccurrence(existing);
      }

      return updated;
   }

   async spawnNextOccurrence(task) {
      const recurrence = task.recurrence;
      const nextStart = task.startDate ? addPeriodISO(task.startDate, recurrence) : null;
      const nextDue = task.dueDate ? addPeriodISO(task.dueDate, recurrence) : null;

      const clone = {
         ...task,
         id: crypto.randomUUID(),
         completed: false,
         completedAt: null,
         dueNotified: false,
         startDate: nextStart ?? nextDue ?? todayISO(),
         dueDate: nextDue,
         scheduledDate: nextDue
      };

      await this.storage.put(STORE, clone);

      if (clone.blockId) {
         const blocks = await this.storage.getAll('timeBlocks');
         const block = blocks.find((b) => b.id === clone.blockId);
         if (block) {
            const taskIds = Array.isArray(block.taskIds) ? block.taskIds : [];
            if (!taskIds.includes(clone.id)) {
               await this.storage.put('timeBlocks', { ...block, taskIds: [...taskIds, clone.id] });
            }
         }
      }

      await this.syncToContext();

      const timeBlockService = slice.getComponent('time-block-service');
      if (clone.blockId && timeBlockService) {
         await timeBlockService.syncToContext();
      }

      slice.events.emit('task:changed', { action: 'recurring-next', task: clone });
      return clone;
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

   /** Tareas pendientes cuya fecha de vencimiento ya llegó y aún no se notificó. */
   getDueReminders(reference = new Date()) {
      const today = reference.toISOString().slice(0, 10);
      return this.getAll().filter((task) => {
         if (task.completed || task.dueNotified) {
            return false;
         }
         const due = task.dueDate || task.scheduledDate;
         return Boolean(due) && due <= today;
      });
   }

   async markDueNotified(id) {
      const existing = this.getById(id);
      if (!existing || existing.dueNotified) {
         return null;
      }
      return this.update(id, { dueNotified: true });
   }
}
