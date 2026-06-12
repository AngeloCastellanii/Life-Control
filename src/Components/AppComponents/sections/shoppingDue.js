function todayISO() {
   return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
   const a = new Date(`${fromISO}T12:00:00`);
   const b = new Date(`${toISO}T12:00:00`);
   return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function formatShortDate(iso) {
   const [y, m, d] = iso.split('-');
   return `${d}/${m}/${y}`;
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
