import { addMinutes, minutesBetween } from '../Service/TimeBlockService/TimeBlockService.js';

export function timeToMinutes(time) {
   if (!time || typeof time !== 'string') {
      return null;
   }
   const [h, m] = time.split(':').map(Number);
   if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return null;
   }
   return h * 60 + m;
}

/** "14:30" → "2:30 PM" (espacio no separable para que no parta en dos líneas) */
export function formatTime12h(time) {
   const mins = timeToMinutes(time);
   if (mins === null) {
      return time || '';
   }
   const hours24 = Math.floor(mins / 60) % 24;
   const minutes = mins % 60;
   const period = hours24 >= 12 ? 'PM' : 'AM';
   const hours12 = hours24 % 12 || 12;
   return `${hours12}:${String(minutes).padStart(2, '0')}\u00A0${period}`;
}

export function formatTaskSlotLabel(slotStart, slotEnd) {
   if (!slotStart || !slotEnd) {
      return '';
   }
   return `${formatTime12h(slotStart)}\u00A0—\u00A0${formatTime12h(slotEnd)}`;
}

export function formatBlockRangeLabel(blockStart, blockEnd) {
   if (!blockStart) {
      return '';
   }
   return `${formatTime12h(blockStart)}\u00A0—\u00A0${formatTime12h(blockEnd ?? blockStart)}`;
}

/** Bloques amplios (varias horas) permiten elegir franja concreta. */
export function blockNeedsSlotPicker(block) {
   if (!block?.start || !block?.end) {
      return false;
   }
   const mins = minutesBetween(block.start, block.end);
   const startHour = Number(block.start.split(':')[0]);
   const endHour = Number(block.end.split(':')[0]);
   return mins > 60 || startHour !== endHour;
}

/** Comprueba que el tramo cae dentro del bloque (soporta bloques y franjas que cruzan medianoche). */
export function isSlotWithinBlock(slotStart, slotEnd, blockStart, blockEnd) {
   const s = timeToMinutes(slotStart);
   let e = timeToMinutes(slotEnd);
   let b0 = timeToMinutes(blockStart);
   let b1 = timeToMinutes(blockEnd);
   if (s === null || e === null || b0 === null || b1 === null) {
      return false;
   }

   // Bloque overnight (ej. 19:00 → 02:30)
   if (b1 <= b0) {
      b1 += 24 * 60;
   }

   // Franja overnight (ej. 21:00 → 02:30)
   if (e <= s) {
      e += 24 * 60;
   }

   let sn = s;
   let en = e;

   // Si el bloque cruza medianoche y la franja cae en la madrugada (antes del inicio del bloque)
   if (b1 > 24 * 60 && sn < b0) {
      sn += 24 * 60;
      en += 24 * 60;
   }

   return sn >= b0 && en <= b1 && en > sn;
}

export function slotDurationMinutes(slotStart, slotEnd) {
   const s = timeToMinutes(slotStart);
   let e = timeToMinutes(slotEnd);
   if (s === null || e === null) {
      return null;
   }
   if (e <= s) {
      e += 24 * 60;
   }
   const duration = e - s;
   return duration > 0 ? duration : null;
}

export function defaultSlotForBlock(block, durationMinutes = 30) {
   if (!block?.start) {
      return { slotStart: null, slotEnd: null };
   }
   const mins = Math.max(1, Number(durationMinutes) || 30);
   const blockMins = minutesBetween(block.start, block.end ?? block.start);
   const useMins = Math.min(mins, blockMins);
   return {
      slotStart: block.start,
      slotEnd: addMinutes(block.start, useMins)
   };
}

/**
 * Coloca la tarea a continuación de las que ya hay en el bloque (corridas).
 * Ej.: 6:00–6:30 AM, luego 6:30–7:00 AM, luego 7:00–7:30 AM.
 */
export function nextStackedSlotForBlock(block, durationMinutes = 30, tasksInBlock = [], excludeTaskId = null) {
   if (!block?.start) {
      return { slotStart: null, slotEnd: null };
   }

   const mins = Math.max(1, Number(durationMinutes) || 30);
   const blockEnd = block.end ?? block.start;
   const blockMins = minutesBetween(block.start, blockEnd);

   const others = (Array.isArray(tasksInBlock) ? tasksInBlock : []).filter(
      (task) =>
         task &&
         task.id !== excludeTaskId &&
         task.slotStart &&
         task.slotEnd &&
         timeToMinutes(task.slotEnd) !== null
   );

   let start = block.start;
   if (others.length > 0) {
      const blockStartMins = timeToMinutes(block.start);
      const sortKey = (slotEnd) => {
         const endMins = timeToMinutes(slotEnd);
         if (endMins === null || blockStartMins === null) {
            return 0;
         }
         // En bloques overnight, 2:30 AM va después de 11:00 PM
         return endMins < blockStartMins ? endMins + 24 * 60 : endMins;
      };
      others.sort((a, b) => sortKey(a.slotEnd) - sortKey(b.slotEnd));
      const lastEnd = others[others.length - 1].slotEnd;
      const lastEndKey = sortKey(lastEnd);
      const blockEndMins = timeToMinutes(blockEnd);
      const blockEndKey =
         blockEndMins !== null && blockStartMins !== null && blockEndMins <= blockStartMins
            ? blockEndMins + 24 * 60
            : blockEndMins;
      if (
         lastEndKey !== null &&
         blockStartMins !== null &&
         blockEndKey !== null &&
         lastEndKey > blockStartMins &&
         lastEndKey < blockEndKey
      ) {
         start = lastEnd;
      }
   }

   const remaining = minutesBetween(start, blockEnd);
   if (remaining < 1) {
      return defaultSlotForBlock(block, mins);
   }

   const useMins = Math.min(mins, remaining, blockMins);
   return {
      slotStart: start,
      slotEnd: addMinutes(start, useMins)
   };
}

/** Fin = inicio + duración, recortado al final del bloque. */
export function slotEndFromStart(slotStart, durationMinutes, block) {
   if (!slotStart || !block?.start) {
      return null;
   }
   const mins = Math.max(1, Number(durationMinutes) || 30);
   const nextEnd = addMinutes(slotStart, mins);
   const blockEnd = block.end ?? block.start;
   const blockMins = minutesBetween(block.start, blockEnd);
   const startOffset = minutesBetween(block.start, slotStart);
   if (startOffset + mins > blockMins) {
      return blockEnd;
   }
   const endMins = timeToMinutes(nextEnd);
   const blockEndMins = timeToMinutes(blockEnd);
   const startMins = timeToMinutes(slotStart);
   if (endMins !== null && blockEndMins !== null && startMins !== null) {
      if (blockEndMins > startMins && endMins > blockEndMins) {
         return blockEnd;
      }
   }
   return nextEnd;
}

/** Inicio = fin − duración, no antes del inicio del bloque. */
export function slotStartFromEnd(slotEnd, durationMinutes, block) {
   if (!slotEnd || !block?.start) {
      return null;
   }
   const mins = Math.max(1, Number(durationMinutes) || 30);
   const nextStart = addMinutes(slotEnd, -mins);
   const blockStart = block.start;
   const startMins = timeToMinutes(nextStart);
   const blockStartMins = timeToMinutes(blockStart);
   const endMins = timeToMinutes(slotEnd);
   if (startMins !== null && blockStartMins !== null && endMins !== null) {
      if (endMins > blockStartMins && startMins < blockStartMins) {
         return blockStart;
      }
   }
   return nextStart;
}

export function compareTasksBySlot(a, b) {
   const aSlot = a?.slotStart ?? '99:99';
   const bSlot = b?.slotStart ?? '99:99';
   if (aSlot !== bSlot) {
      return aSlot.localeCompare(bSlot);
   }
   return (a?.title ?? '').localeCompare(b?.title ?? '');
}

export function validateTaskSlot({ slotStart, slotEnd, block }) {
   if (!block) {
      return { ok: true, slotStart: null, slotEnd: null };
   }
   if (!slotStart || !slotEnd) {
      return { ok: false, message: 'Indica hora de inicio y fin dentro del bloque.' };
   }
   if (!isSlotWithinBlock(slotStart, slotEnd, block.start, block.end ?? block.start)) {
      return {
         ok: false,
         message: `El horario debe estar entre ${formatTime12h(block.start)} y ${formatTime12h(block.end ?? block.start)}.`
      };
   }
   const duration = slotDurationMinutes(slotStart, slotEnd);
   if (!duration || duration < 1) {
      return { ok: false, message: 'La hora de fin debe ser posterior al inicio.' };
   }
   return { ok: true, slotStart, slotEnd, duration };
}
