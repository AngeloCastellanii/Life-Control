export function todayISO() {
   const now = new Date();
   return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseISO(iso) {
   return new Date(`${iso}T12:00:00`);
}

export function toISO(date) {
   return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(iso, days) {
   const date = parseISO(iso);
   date.setDate(date.getDate() + days);
   return toISO(date);
}

export function addMonths(iso, months) {
   const date = parseISO(iso);
   const day = date.getDate();
   date.setDate(1);
   date.setMonth(date.getMonth() + months);
   const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
   date.setDate(Math.min(day, lastDay));
   return toISO(date);
}

export function isSameDay(a, b) {
   return a === b;
}

export function startOfWeek(iso) {
   const date = parseISO(iso);
   const day = date.getDay();
   const diff = day === 0 ? -6 : 1 - day;
   date.setDate(date.getDate() + diff);
   return toISO(date);
}

export function getWeekDays(iso) {
   const start = startOfWeek(iso);
   return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getMonthMatrix(iso) {
   const date = parseISO(iso);
   const year = date.getFullYear();
   const month = date.getMonth();
   const first = new Date(year, month, 1);
   const last = new Date(year, month + 1, 0);
   const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
   const cells = [];

   for (let index = 0; index < startOffset; index += 1) {
      const cellDate = new Date(year, month, 1 - (startOffset - index));
      cells.push({ iso: toISO(cellDate), inMonth: false });
   }

   for (let day = 1; day <= last.getDate(); day += 1) {
      cells.push({ iso: toISO(new Date(year, month, day)), inMonth: true });
   }

   while (cells.length % 7 !== 0) {
      const nextDay = cells.length - startOffset - last.getDate() + 1;
      cells.push({ iso: toISO(new Date(year, month + 1, nextDay)), inMonth: false });
   }

   const weeks = [];
   for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
   }
   return weeks;
}

export function formatDayLong(iso) {
   const date = parseISO(iso);
   const text = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
   return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatWeekLabel(iso) {
   const start = parseISO(startOfWeek(iso));
   const text = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
   return `Semana del ${text.charAt(0).toUpperCase() + text.slice(1)}`;
}

export function formatMonthLabel(iso) {
   const date = parseISO(iso);
   const text = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
   return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDay(iso) {
   const date = parseISO(iso);
   const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
   return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date.getDate()}`;
}

export function daysUntil(iso, fromIso = todayISO()) {
   const from = parseISO(fromIso);
   const target = parseISO(iso);
   return Math.round((target - from) / 86400000);
}

/** Rango de fechas (compatible con scheduledDate legacy). */
export function taskDateRange(task) {
   const due = task?.dueDate ?? task?.scheduledDate ?? null;
   const start = task?.startDate ?? due ?? null;
   const end = due ?? start ?? null;
   return { start, end };
}

/** El día cae dentro del rango activo de la tarea. */
export function taskActiveOnDay(task, iso) {
   const { start, end } = taskDateRange(task);
   if (start && iso < start) {
      return false;
   }
   if (end && iso > end) {
      return false;
   }
   return true;
}

/** Día de referencia para historial de tareas completadas. */
export function taskCompletionDay(task) {
   const { end } = taskDateRange(task);
   return task?.completedAt ?? end ?? task?.dueDate ?? task?.scheduledDate ?? task?.startDate ?? null;
}

/** Fechas de inbox ancladas al día actual (al sacar de un bloque). */
export function inboxDatesAnchoredToToday(task, today = todayISO()) {
   const { end } = taskDateRange(task);
   const due = end && end >= today ? end : today;
   return {
      startDate: today,
      dueDate: due,
      scheduledDate: due
   };
}

/** Inbox: sin bloque; pendientes vencidas visibles desde hoy; completadas solo en días pasados. */
export function taskInInboxOnDay(task, iso, today = todayISO()) {
   if (task?.blockId) {
      return false;
   }
   if (task.completed) {
      if (iso >= today) {
         return false;
      }
      return taskActiveOnDay(task, iso);
   }

   const { end } = taskDateRange(task);
   if (end && end < today) {
      return iso >= today;
   }

   return taskActiveOnDay(task, iso);
}

/** Bloque: pendientes persisten tras vencimiento; completadas visibles hasta el día en que se tacharon. */
export function taskInBlockOnDay(task, iso, today = todayISO()) {
   if (!task?.blockId) {
      return false;
   }

   const { start } = taskDateRange(task);
   if (start && iso < start) {
      return false;
   }

   if (!task.completed) {
      if (iso >= today) {
         return true;
      }
      return taskActiveOnDay(task, iso);
   }

   const historyDay = taskCompletionDay(task);
   if (!historyDay) {
      return taskActiveOnDay(task, iso);
   }

   return iso <= historyDay;
}

/** Semana / mes: delega en reglas de bloque o inbox según ubicación de la tarea. */
export function taskShowsOnCalendarDay(task, iso, today = todayISO()) {
   if (task?.blockId) {
      return taskInBlockOnDay(task, iso, today);
   }
   return taskInInboxOnDay(task, iso, today);
}

/** @deprecated Usar taskActiveOnDay / taskInBlockOnDay */
export function taskBelongsToDay(task, iso) {
   return taskInBlockOnDay(task, iso);
}

export function dueBadgeLabel(iso, fromIso = todayISO()) {
   const diff = daysUntil(iso, fromIso);
   if (diff < 0) {
      return 'VENCIDO';
   }
   if (diff === 0) {
      return 'HOY';
   }
   if (diff === 1) {
      return 'EN 1D';
   }
   return `EN ${diff}D`;
}
