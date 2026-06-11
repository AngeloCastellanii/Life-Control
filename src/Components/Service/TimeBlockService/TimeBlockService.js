const STORE = 'timeBlocks';

const DEFAULT_BLOCKS = [
   { label: 'Mañana', start: '06:00', end: '11:59' },
   { label: 'Tarde', start: '12:00', end: '18:59' },
   { label: 'Noche', start: '19:00', end: '00:00' }
];

export const BLOCK_RULE = {
   LOCKED: 'locked',
   FLEXIBLE: 'flexible'
};

export function minutesBetween(start, end) {
   const [sh, sm] = start.split(':').map(Number);
   const [eh, em] = end.split(':').map(Number);
   let mins = eh * 60 + em - (sh * 60 + sm);
   if (mins <= 0) {
      mins += 24 * 60;
   }
   return mins;
}

export function addMinutes(time, mins) {
   const [h, m] = time.split(':').map(Number);
   const total = h * 60 + m + mins;
   const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
   const nh = Math.floor(wrapped / 60);
   const nm = wrapped % 60;
   return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function normalizeBlock(block) {
   if (!block.end && block.start && block.duration) {
      return { ...block, end: addMinutes(block.start, block.duration) };
   }
   if (block.end && block.start && !block.duration) {
      return { ...block, duration: minutesBetween(block.start, block.end) };
   }
   return block;
}

export default class TimeBlockService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage?.db) {
         await this.storage.init();
      }
      this.taskService = slice.getComponent('task-service');
      await this.seedDefaultBlocks();
      await this.syncToContext();
   }

   async seedDefaultBlocks() {
      const existing = await this.storage.getAll(STORE);
      const labels = new Set(existing.map((block) => block.label));
      let added = false;

      for (const def of DEFAULT_BLOCKS) {
         if (labels.has(def.label)) {
            continue;
         }

         const block = {
            id: crypto.randomUUID(),
            label: def.label,
            start: def.start,
            end: def.end,
            duration: minutesBetween(def.start, def.end),
            rule: BLOCK_RULE.FLEXIBLE,
            taskIds: []
         };
         await this.storage.put(STORE, block);
         added = true;
      }

      if (added) {
         await this.storage.put('meta', { id: 'defaultBlocksSeeded', value: true });
      }
   }

   async syncToContext() {
      const timeBlocks = (await this.storage.getAll(STORE)).map(normalizeBlock);
      timeBlocks.sort((a, b) => a.start.localeCompare(b.start));

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         timeBlocks
      }));
   }

   getAll() {
      return (slice.context.getState('lifeControl')?.timeBlocks ?? []).map(normalizeBlock);
   }

   getById(id) {
      return this.getAll().find((b) => b.id === id) ?? null;
   }

   acceptsTasks(block) {
      return (block?.rule ?? BLOCK_RULE.FLEXIBLE) === BLOCK_RULE.FLEXIBLE;
   }

   usedMinutes(blockId) {
      const tasks = slice.context.getState('lifeControl')?.tasks ?? [];
      return tasks
         .filter((t) => t.blockId === blockId && t.completed)
         .reduce((sum, t) => sum + (t.minutes ?? 0), 0);
   }

   async update(id, { label, start, end, rule }) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const trimmed = label?.trim();
      if (!trimmed || !start || !end) {
         return null;
      }

      const duration = minutesBetween(start, end);
      if (duration < 15) {
         return null;
      }

      const block = {
         ...existing,
         label: trimmed,
         start,
         end,
         duration,
         rule: rule ?? existing.rule ?? BLOCK_RULE.FLEXIBLE
      };

      await this.storage.put(STORE, block);
      await this.syncToContext();
      slice.events.emit('time-block:changed', { action: 'update', block });
      return block;
   }

   async create({ label, start, end, rule = BLOCK_RULE.FLEXIBLE }) {
      const trimmed = label?.trim();
      if (!trimmed || !start || !end) {
         return null;
      }

      const duration = minutesBetween(start, end);
      if (duration < 15) {
         return null;
      }

      const block = {
         id: crypto.randomUUID(),
         label: trimmed,
         start,
         end,
         duration,
         rule,
         taskIds: []
      };

      await this.storage.put(STORE, block);
      await this.syncToContext();
      slice.events.emit('time-block:changed', { action: 'create', block });
      return block;
   }

   async assignTask(blockId, taskId) {
      const block = this.getById(blockId);
      const task = this.taskService.getAll().find((t) => t.id === taskId);
      if (!block || !task) {
         return null;
      }

      if (!this.acceptsTasks(block)) {
         slice.events.emit('time-block:assign-blocked', { blockId, taskId, reason: 'locked' });
         return null;
      }

      if (task.blockId && task.blockId !== blockId) {
         await this.unassignTask(task.blockId, taskId);
      }

      const taskIds = block.taskIds.includes(taskId) ? block.taskIds : [...block.taskIds, taskId];
      await this.storage.put(STORE, { ...block, taskIds });
      await this.taskService.update(taskId, { blockId });
      await this.syncToContext();
      slice.events.emit('time-block:changed', { action: 'assign', blockId, taskId });
      return true;
   }

   async unassignTask(blockId, taskId) {
      const block = this.getById(blockId);
      if (!block) {
         return null;
      }

      const taskIds = block.taskIds.filter((id) => id !== taskId);
      await this.storage.put(STORE, { ...block, taskIds });
      await this.taskService.update(taskId, { blockId: null });
      await this.syncToContext();
      slice.events.emit('time-block:changed', { action: 'unassign', blockId, taskId });
      return true;
   }

   async remove(id) {
      const block = this.getById(id);
      if (!block) {
         return false;
      }

      for (const taskId of block.taskIds) {
         await this.taskService.update(taskId, { blockId: null });
      }

      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('time-block:changed', { action: 'delete', id });
      return true;
   }
}
