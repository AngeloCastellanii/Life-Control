import { FINANCE_TYPE } from '../FinanceService/FinanceService.js';

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

export function getReminderWindowDays(frequency) {
   switch (frequency) {
      case SHOPPING_FREQUENCY.DAILY:
         return 0;
      case SHOPPING_FREQUENCY.WEEKLY:
         return 3;
      case SHOPPING_FREQUENCY.MONTHLY:
         return 7;
      case SHOPPING_FREQUENCY.YEARLY:
         return 14;
      default:
         return 7;
   }
}

export function getDueStatus(item) {
   const today = todayISO();
   const next = item.nextDueAt ?? today;

   if (item.checked) {
      if (next <= today) {
         return { state: 'renew', label: 'Toca de nuevo', priority: 0 };
      }
      const diff = daysBetween(today, next);
      const window = getReminderWindowDays(item.frequency);
      if (diff <= window) {
         if (diff === 0) {
            return { state: 'today', label: 'Toca hoy', priority: -5 };
         }
         if (diff === 1) {
            return { state: 'soon', label: 'Mañana', priority: 1 };
         }
         return { state: 'approaching', label: `En ${diff} días`, priority: diff };
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

function normalizePrice(value) {
   const n = Number(value);
   if (!Number.isFinite(n) || n <= 0) {
      return null;
   }
   return Math.round(n * 100) / 100;
}

function normalizeItem(item) {
   const today = todayISO();
   const freq = FREQUENCY_ORDER[item.frequency] !== undefined ? item.frequency : SHOPPING_FREQUENCY.WEEKLY;
   const normalized = {
      ...item,
      nextDueAt: item.nextDueAt ?? today,
      lastDoneAt: item.lastDoneAt ?? null,
      price: normalizePrice(item.price),
      accountId: item.accountId || null,
      lastFinanceId: item.lastFinanceId || null,
      lastFinanceAt: item.lastFinanceAt || null
   };

   if (normalized.lastDoneAt && normalized.nextDueAt <= normalized.lastDoneAt) {
      normalized.nextDueAt = addPeriod(normalized.lastDoneAt, freq);
   }

   if (normalized.lastDoneAt && normalized.nextDueAt > today) {
      normalized.checked = true;
   } else if (normalized.checked && normalized.nextDueAt <= today) {
      normalized.checked = false;
   }

   normalized.lastReminderDate = normalized.lastReminderDate ?? null;

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
      const today = todayISO();
      return this.getAll().filter((item) => {
         const next = item.nextDueAt ?? today;
         if (next === isoDate) {
            return true;
         }
         if (!item.checked && next < isoDate && isoDate >= today) {
            return true;
         }
         return false;
      });
   }

   getDueItems({ withinDays } = {}) {
      const today = todayISO();
      return this.getAll()
         .filter((item) => {
            const next = item.nextDueAt ?? today;
            const daysLeft = daysBetween(today, next);
            const window =
               typeof withinDays === 'number' ? withinDays : getReminderWindowDays(item.frequency);

            if (daysLeft <= 0) {
               return true;
            }
            return daysLeft <= window;
         })
         .sort((a, b) => getDueStatus(a).priority - getDueStatus(b).priority);
   }

   /**
    * Ítems que necesitan aviso diario: dentro de la ventana o vencidos,
    * y aún no se han repuesto (o toca renovar). Un aviso por día.
    * Reponer = marcar como comprado (checked), que reinicia nextDueAt.
    */
   getDailyReminderItems(reference = new Date()) {
      const today = reference.toISOString().slice(0, 10);
      return this.getDueItems().filter((item) => {
         const status = getDueStatus(item);
         if (status.state === 'done') {
            return false;
         }
         return item.lastReminderDate !== today;
      });
   }

   async markDailyReminder(id, dateISO = todayISO()) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      const updated = { ...existing, lastReminderDate: dateISO };
      await this.storage.put(STORE, updated);
      await this.syncToContext();
      return updated;
   }

   async create({ name, frequency, lastDoneAt, nextDueAt, price = null, accountId = null }) {
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
         price: normalizePrice(price),
         accountId: accountId || null,
         checked: dates.checked,
         lastDoneAt: dates.lastDoneAt,
         nextDueAt: dates.nextDueAt,
         lastFinanceId: null,
         lastFinanceAt: null
      };

      await this.storage.put(STORE, item);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'create', item });
      return item;
   }

   async syncPurchaseToFinance(item) {
      const price = normalizePrice(item.price);
      if (!price) {
         return { financeId: item.lastFinanceId ?? null, financeAt: item.lastFinanceAt ?? null };
      }

      const today = todayISO();
      // Evita duplicar el mismo egreso si se marca/desmarca el mismo día
      if (item.lastFinanceId && item.lastFinanceAt === today) {
         return { financeId: item.lastFinanceId, financeAt: item.lastFinanceAt };
      }

      const financeService = slice.getComponent('finance-service');
      if (!financeService?.create) {
         return { financeId: item.lastFinanceId ?? null, financeAt: item.lastFinanceAt ?? null };
      }

      const finance = await financeService.create({
         description: `Compra: ${item.name}`,
         amount: price,
         type: FINANCE_TYPE.PAY,
         dueDate: today,
         accountId: item.accountId || null,
         shoppingItemId: item.id
      });

      if (!finance) {
         return { financeId: item.lastFinanceId ?? null, financeAt: item.lastFinanceAt ?? null };
      }

      // Al marcar comprado = dinero ya gastado → se aplica al saldo del método
      if (typeof financeService.toggleSettled === 'function') {
         await financeService.toggleSettled(finance.id, true);
      }

      return { financeId: finance.id, financeAt: today };
   }

   async toggleChecked(id, checked) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const today = todayISO();
      let updated;

      if (checked) {
         const { financeId, financeAt } = await this.syncPurchaseToFinance(existing);
         updated = {
            ...existing,
            checked: true,
            lastDoneAt: today,
            nextDueAt: addPeriod(today, existing.frequency),
            lastReminderDate: null,
            lastFinanceId: financeId,
            lastFinanceAt: financeAt
         };
      } else {
         updated = {
            ...existing,
            checked: false,
            nextDueAt: today,
            lastReminderDate: null
         };
      }

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('shopping:changed', { action: 'update', item: updated });
      return updated;
   }

   async update(id, { name, frequency, lastDoneAt, nextDueAt, price, accountId }) {
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
         price: price !== undefined ? normalizePrice(price) : existing.price,
         accountId: accountId !== undefined ? accountId || null : existing.accountId,
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
