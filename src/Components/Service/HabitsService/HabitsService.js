import { addDays, todayISO } from '../../AppComponents/sections/plannerDates.js';

const STORE = 'habits';
const KEEP_DAYS = 400;

function nowISO() {
   return new Date().toISOString();
}

function normalizeDates(dates) {
   if (!Array.isArray(dates)) {
      return [];
   }
   const cutoff = addDays(todayISO(), -KEEP_DAYS);
   const unique = new Set();
   for (const value of dates) {
      const day = String(value ?? '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day >= cutoff) {
         unique.add(day);
      }
   }
   return [...unique].sort();
}

function normalizeHabit(habit) {
   return {
      id: habit.id,
      name: (habit.name ?? '').trim(),
      doneDates: normalizeDates(habit.doneDates),
      createdAt: habit.createdAt ?? nowISO(),
      updatedAt: habit.updatedAt ?? habit.createdAt ?? nowISO()
   };
}

function compareHabits(a, b) {
   return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

export function habitStreak(doneDates, today = todayISO()) {
   const set = new Set(doneDates ?? []);
   let day = set.has(today) ? today : addDays(today, -1);
   if (!set.has(day)) {
      return 0;
   }
   let count = 0;
   while (set.has(day)) {
      count += 1;
      day = addDays(day, -1);
   }
   return count;
}

export function lastDays(count = 7, today = todayISO()) {
   const days = [];
   for (let offset = count - 1; offset >= 0; offset -= 1) {
      days.push(addDays(today, -offset));
   }
   return days;
}

export default class HabitsService {
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
      const habits = (await this.storage.getAll(STORE)).map(normalizeHabit);
      habits.sort(compareHabits);
      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         habits
      }));
   }

   getAll() {
      return (slice.context.getState('lifeControl')?.habits ?? []).map(normalizeHabit);
   }

   getById(id) {
      return this.getAll().find((habit) => habit.id === id) ?? null;
   }

   async create({ name }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }
      const habit = normalizeHabit({
         id: crypto.randomUUID(),
         name: trimmed,
         doneDates: [],
         createdAt: nowISO(),
         updatedAt: nowISO()
      });
      await this.storage.put(STORE, habit);
      await this.syncToContext();
      slice.events.emit('habit:changed', { action: 'create', habit });
      return habit;
   }

   async update(id, patch) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      const updated = normalizeHabit({
         ...existing,
         ...patch,
         id,
         updatedAt: nowISO()
      });
      if (!updated.name) {
         return null;
      }
      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('habit:changed', { action: 'update', habit: updated });
      return updated;
   }

   async toggleDate(id, iso = todayISO()) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      const day = String(iso).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
         return null;
      }
      const set = new Set(existing.doneDates);
      if (set.has(day)) {
         set.delete(day);
      } else {
         set.add(day);
      }
      return this.update(id, { doneDates: [...set] });
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('habit:changed', { action: 'delete', id });
      return true;
   }
}
