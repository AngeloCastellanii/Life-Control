/** Formatea minutos como "45 min", "2 h", "6 h 20 min", "3 d", "1 d 2 h". */
export function formatDuration(totalMinutes, { short = false } = {}) {
   const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
   if (mins === 0) {
      return short ? '0 min' : '0 minutos';
   }

   const days = Math.floor(mins / (24 * 60));
   const afterDays = mins % (24 * 60);
   const hours = Math.floor(afterDays / 60);
   const minutes = afterDays % 60;

   const parts = [];
   if (days > 0) {
      parts.push(short ? `${days} d` : `${days} ${days === 1 ? 'día' : 'días'}`);
   }
   if (hours > 0) {
      parts.push(short ? `${hours} h` : `${hours} ${hours === 1 ? 'hora' : 'horas'}`);
   }
   if (minutes > 0) {
      parts.push(short ? `${minutes} min` : `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
   }

   if (short) {
      return parts.join(' ');
   }
   if (parts.length === 1) {
      return parts[0];
   }
   if (parts.length === 2) {
      return `${parts[0]} y ${parts[1]}`;
   }
   return `${parts[0]}, ${parts[1]} y ${parts[2]}`;
}

export function formatDurationFree(remainingMinutes) {
   return `${formatDuration(remainingMinutes, { short: true })} libres`;
}

export function formatDurationUsage(used, total) {
   return `${formatDuration(used, { short: true })} / ${formatDuration(total, { short: true })}`;
}

const DAY_MINUTES = 24 * 60;
const HOUR_MINUTES = 60;

/** Convierte valor + unidad a minutos enteros. */
export function durationToMinutes(value, unit) {
   const amount = Math.max(0, Number(value) || 0);
   if (unit === 'days') {
      return Math.max(1, Math.round(amount * DAY_MINUTES));
   }
   if (unit === 'hours') {
      return Math.max(1, Math.round(amount * HOUR_MINUTES));
   }
   return Math.max(1, Math.round(amount));
}

/** Elige unidad legible al editar una tarea guardada en minutos. */
export function minutesToDurationParts(totalMinutes) {
   const mins = Math.max(1, Math.round(Number(totalMinutes) || 30));
   if (mins >= DAY_MINUTES && mins % DAY_MINUTES === 0) {
      return { value: mins / DAY_MINUTES, unit: 'days' };
   }
   if (mins >= HOUR_MINUTES && mins % HOUR_MINUTES === 0) {
      return { value: mins / HOUR_MINUTES, unit: 'hours' };
   }
   if (mins >= HOUR_MINUTES) {
      return { value: Number((mins / HOUR_MINUTES).toFixed(2)), unit: 'hours' };
   }
   return { value: mins, unit: 'minutes' };
}

export { DAY_MINUTES, HOUR_MINUTES };
