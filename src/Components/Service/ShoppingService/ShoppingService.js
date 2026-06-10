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

export function todayISO() {
   return new Date().toISOString().slice(0, 10);
}

export function addPeriod(dateStr, frequency) {
   const d = new Date(`${dateStr}T12:00:00`);
   switch (frequency) {
      case SHOPPING_FREQUENCY.DAILY:
         d.setDate(d.getDate() + 1);
         break;
      case SHOPPING_FREQUENCY.WEEKLY:
         d.setDate(d.getDate() + 7);
         break;
      case SHOPPING_FREQUENCY.MONTHLY:
         d.setMonth(d.getMonth() + 1);
         break;
      case SHOPPING_FREQUENCY.YEARLY:
         d.setFullYear(d.getFullYear() + 1);
         break;
      default:
         d.setDate(d.getDate() + 7);
   }
   return d.toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
   const a = new Date(`${fromISO}T12:00:00`);
   const b = new Date(`${toISO}T12:00:00`);
   return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function getDueStatus(item) {
   const today = todayISO();
   const next = item.nextDueAt ?? today;

   if (item.checked) {
      if (next <= today) {
         return { state: 'renew', label: 'Toca de nuevo', priority: 0 };
      }
      return { state: 'done', label: `Próximo: ${formatShortDate(next)}`, priority: 5 };
   }

   const diff = daysBetween(today, next);
   if (diff < 0) {
      const overdue = Math.abs(diff);
      return {
         state: 'overdue',
         label: overdue === 1 ? 'Vencido ayer' : `Vencido hace ${overdue} días`,
         priority: -10 + overdue
      };
   }
   if (diff === 0) {
      return { state: 'today', label: 'Toca hoy', priority: -5 };
   }
   if (diff === 1) {
      return { state: 'soon', label: 'Mañana', priority: 1 };
   }
   return { state: 'upcoming', label: `En ${diff} días`, priority: diff };
}

function formatShortDate(iso) {
   const [y, m, d] = iso.split('-');
   return `${d}/${m}/${y}`;
}

export function buildItemDates({ lastDoneAt, nextDueAt, frequency }) {
   const today = todayISO();
   const freq = FREQUENCY_ORDER[frequency] !== undefined ? frequency : SHOPPING_FREQUENCY.WEEKLY;
   let last = lastDoneAt?.trim() || null;
   let next = nextDueAt?.trim() || null;

   if (last && (!next || next <= last)) {
      next = addPeriod(last, freq);
   }
   if (!next) {
      next = today;
   }
   if (last && last > today) {
      last = today;
      next = addPeriod(last, freq);
   }

   const checked = Boolean(last && next > today);

   return { lastDoneAt: last, nextDueAt: next, checked };
}

function normalizeItem(item) {
   const today = todayISO();
   const freq = FREQUENCY_ORDER[item.frequency] !== undefined ? item.frequency : SHOPPING_FREQUENCY.WEEKLY;
   const normalized = {
      ...item,
      nextDueAt: item.nextDueAt ?? today,
      lastDoneAt: item.lastDoneAt ?? null
   };

   if (normalized.lastDoneAt && normalized.nextDueAt <= normalized.lastDoneAt) {
      normalized.nextDueAt = addPeriod(normalized.lastDoneAt, freq);
   }

   if (normalized.lastDoneAt && normalized.nextDueAt > today) {
      normalized.checked = true;
   } else if (normalized.checked && normalized.nextDueAt <= today) {
      normalized.checked = false;
   }

   return normalized;
}

export default class ShoppingService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage) {
         throw new Error('StorageService no está disponible');
      }
      if (!this.storage.db) {
         await this.storage.init();
      }
      await this.migrateItems();
      await this.syncToContext();
   }

   async migrateItems() {
      const items = await this.storage.getAll(STORE);
      let changed = false;
      for (const item of items) {
         const normalized = normalizeItem(item);
         if (
            normalized.nextDueAt !== item.nextDueAt ||
            normalized.checked !== item.checked ||
            normalized.lastDoneAt !== item.lastDoneAt
         ) {
            await this.storage.put(STORE, normalized);
            changed = true;
         }
      }
      return changed;
   }

   async syncToContext() {
      const shopping = (await this.storage.getAll(STORE)).map(normalizeItem);
      shopping.sort((a, b) => {
         const statusA = getDueStatus(a);
         const statusB = getDueStatus(b);
         if (statusA.priority !== statusB.priority) {
            return statusA.priority - statusB.priority;
         }
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
      return (slice.context.getState('lifeControl')?.shopping ?? []).map(normalizeItem);
   }

   getById(id) {
      return this.getAll().find((item) => item.id === id) ?? null;
   }

   getByFrequency(frequency) {
      return this.getAll().filter((item) => item.frequency === frequency);
   }

   getDueOnDate(isoDate) {
      return this.getAll().filter((item) => item.nextDueAt === isoDate);
   }

   getDueItems({ withinDays = 7 } = {}) {
      const today = todayISO();
      return this.getAll()
         .filter((item) => {
            const status = getDueStatus(item);
            if (status.state === 'overdue' || status.state === 'today' || status.state === 'renew') {
               return true;
            }
            if (status.state === 'done') {
               return false;
            }
            return daysBetween(today, item.nextDueAt ?? today) <= withinDays;
         })
         .sort((a, b) => getDueStatus(a).priority - getDueStatus(b).priority);
   }

   async create({ name, frequency, lastDoneAt, nextDueAt }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const freq = FREQUENCY_ORDER[frequency] !== undefined ? frequency : SHOPPING_FREQUENCY.WEEKLY;
      const dates = buildItemDates({ lastDoneAt, nextDueAt, frequency: freq });

      const item = {
         id: crypto.randomUUID(),
         name: trimmed,
         frequency: freq,
         checked: dates.checked,
         lastDoneAt: dates.lastDoneAt,
         nextDueAt: dates.nextDueAt
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

      const today = todayISO();
      let updated;

      if (checked) {
         updated = {
            ...existing,
            checked: true,
            lastDoneAt: today,
            nextDueAt: addPeriod(today, existing.frequency)
         };
      } else {
         updated = {
            ...existing,
            checked: false,
            nextDueAt: today
         };
      }

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'update', item: updated });
      return updated;
   }

   async update(id, { name, frequency, lastDoneAt, nextDueAt }) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const freq = FREQUENCY_ORDER[frequency] !== undefined ? frequency : existing.frequency;
      const hasDateInput = lastDoneAt !== undefined || nextDueAt !== undefined;
      const dates = hasDateInput
         ? buildItemDates({
              lastDoneAt: lastDoneAt ?? existing.lastDoneAt,
              nextDueAt: nextDueAt ?? existing.nextDueAt,
              frequency: freq
           })
         : {
              lastDoneAt: existing.lastDoneAt,
              nextDueAt: existing.nextDueAt ?? todayISO(),
              checked: existing.checked
           };

      const updated = {
         ...existing,
         name: trimmed,
         frequency: freq,
         lastDoneAt: dates.lastDoneAt,
         nextDueAt: dates.nextDueAt,
         checked: dates.checked
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
