import { addDays, parseISO, startOfWeek, todayISO } from '../../AppComponents/sections/plannerDates.js';

const STORE = 'habits';
const KEEP_DAYS = 400;
const COLORS = ['#3f7359', '#2563eb', '#c41e5a', '#d97706', '#7c3aed', '#0891b2'];

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

function normalizeWeekdays(days) {
   if (!Array.isArray(days) || days.length === 0) {
      return [1, 2, 3, 4, 5];
   }
   return [...new Set(days.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6))].sort();
}

export function normalizeHabit(habit) {
   const frequency = ['daily', 'weekdays', 'custom', 'weekly'].includes(habit?.frequency)
      ? habit.frequency
      : 'daily';
   return {
      id: habit.id,
      name: (habit.name ?? '').trim(),
      notes: (habit.notes ?? '').trim(),
      color: habit.color || COLORS[0],
      frequency,
      weekdays: normalizeWeekdays(habit.weekdays),
      weeklyTarget: Math.min(7, Math.max(1, Number(habit.weeklyTarget) || 4)),
      remindAt: /^\d{2}:\d{2}$/.test(habit.remindAt ?? '') ? habit.remindAt : '',
      paused: Boolean(habit.paused),
      doneDates: normalizeDates(habit.doneDates),
      skippedDates: normalizeDates(habit.skippedDates),
      createdAt: habit.createdAt ?? nowISO(),
      updatedAt: habit.updatedAt ?? habit.createdAt ?? nowISO()
   };
}

function compareHabits(a, b) {
   if (Boolean(a.paused) !== Boolean(b.paused)) {
      return a.paused ? 1 : -1;
   }
   return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

export function lastDays(count = 7, today = todayISO()) {
   const days = [];
   for (let offset = count - 1; offset >= 0; offset -= 1) {
      days.push(addDays(today, -offset));
   }
   return days;
}

export function isHabitDueOn(habit, iso) {
   if (habit.paused) {
      return false;
   }
   const weekday = parseISO(iso).getDay();
   if (habit.frequency === 'weekdays') {
      return weekday >= 1 && weekday <= 5;
   }
   if (habit.frequency === 'custom') {
      return (habit.weekdays ?? []).includes(weekday);
   }
   return true;
}

export function weekProgress(habit, today = todayISO()) {
   const start = startOfWeek(today);
   const days = lastDays(7, addDays(start, 6));
   const done = new Set(habit.doneDates);
   const doneCount = days.filter((day) => day >= start && day <= today && done.has(day)).length;
   if (habit.frequency === 'weekly') {
      return { done: doneCount, target: habit.weeklyTarget || 4 };
   }
   const dueDays = days.filter((day) => day >= start && day <= addDays(start, 6) && isHabitDueOn(habit, day));
   return { done: doneCount, target: Math.max(1, dueDays.length) };
}

export function habitStreak(habit, today = todayISO()) {
   const done = new Set(habit.doneDates ?? []);
   const skipped = new Set(habit.skippedDates ?? []);
   let day = today;
   let count = 0;
   for (let i = 0; i < KEEP_DAYS; i += 1) {
      if (!isHabitDueOn({ ...habit, paused: false }, day)) {
         day = addDays(day, -1);
         continue;
      }
      if (done.has(day)) {
         count += 1;
         day = addDays(day, -1);
         continue;
      }
      if (skipped.has(day) || day === today) {
         day = addDays(day, -1);
         continue;
      }
      break;
   }
   return count;
}

export function bestStreak(habit) {
   const done = new Set(habit.doneDates ?? []);
   const skipped = new Set(habit.skippedDates ?? []);
   if (done.size === 0) {
      return 0;
   }
   const today = todayISO();
   let best = 0;
   let current = 0;
   for (let offset = KEEP_DAYS; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset);
      if (!isHabitDueOn({ ...habit, paused: false }, day)) {
         continue;
      }
      if (done.has(day)) {
         current += 1;
         best = Math.max(best, current);
      } else if (skipped.has(day)) {
         continue;
      } else {
         current = 0;
      }
   }
   return best;
}

export function monthGrid(today = todayISO()) {
   const first = `${today.slice(0, 7)}-01`;
   const start = parseISO(first);
   const startPad = start.getDay();
   const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
   const cells = [];
   for (let i = 0; i < startPad; i += 1) {
      cells.push(null);
   }
   for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(`${today.slice(0, 7)}-${String(day).padStart(2, '0')}`);
   }
   return cells;
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

   async create(payload) {
      const habit = normalizeHabit({
         id: crypto.randomUUID(),
         ...payload,
         doneDates: [],
         skippedDates: [],
         createdAt: nowISO(),
         updatedAt: nowISO()
      });
      if (!habit.name) {
         return null;
      }
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
      const done = new Set(existing.doneDates);
      const skipped = new Set(existing.skippedDates);
      if (done.has(day)) {
         done.delete(day);
      } else {
         done.add(day);
         skipped.delete(day);
      }
      return this.update(id, { doneDates: [...done], skippedDates: [...skipped] });
   }

   async skipDate(id, iso = todayISO()) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      const day = String(iso).slice(0, 10);
      const done = new Set(existing.doneDates);
      const skipped = new Set(existing.skippedDates);
      if (skipped.has(day)) {
         skipped.delete(day);
      } else {
         skipped.add(day);
         done.delete(day);
      }
      return this.update(id, { doneDates: [...done], skippedDates: [...skipped] });
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('habit:changed', { action: 'delete', id });
      return true;
   }
}
