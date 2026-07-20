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

export function formatTaskSlotLabel(slotStart, slotEnd) {
   if (!slotStart || !slotEnd) {
      return '';
   }
   return `${slotStart} — ${slotEnd}`;
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

/** Comprueba que el tramo cae dentro del bloque (soporta bloques que cruzan medianoche). */
export function isSlotWithinBlock(slotStart, slotEnd, blockStart, blockEnd) {
   const s = timeToMinutes(slotStart);
   const e = timeToMinutes(slotEnd);
   let b0 = timeToMinutes(blockStart);
   let b1 = timeToMinutes(blockEnd);
   if (s === null || e === null || b0 === null || b1 === null) {
      return false;
   }
   if (e <= s) {
      return false;
   }
   if (b1 <= b0) {
      b1 += 24 * 60;
   }
   let slotStartNorm = s;
   let slotEndNorm = e;
   if (slotStartNorm < b0 && b1 > 24 * 60) {
      slotStartNorm += 24 * 60;
      slotEndNorm += 24 * 60;
   }
   return slotStartNorm >= b0 && slotEndNorm <= b1;
}

export function slotDurationMinutes(slotStart, slotEnd) {
   const s = timeToMinutes(slotStart);
   const e = timeToMinutes(slotEnd);
   if (s === null || e === null || e <= s) {
      return null;
   }
   return e - s;
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
   // Si el fin calculado se pasa del bloque en el mismo día (comparación simple)
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
         message: `El horario debe estar entre ${block.start} y ${block.end ?? block.start}.`
      };
   }
   const duration = slotDurationMinutes(slotStart, slotEnd);
   if (!duration || duration < 1) {
      return { ok: false, message: 'La hora de fin debe ser posterior al inicio.' };
   }
   return { ok: true, slotStart, slotEnd, duration };
}
