/** Paleta de respaldo si aún no hay dominios. */
const FALLBACK_NOTE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

/** Colores de notas = colores de los dominios del usuario (únicos). */
export function getNoteColors() {
   const domains = slice.context?.getState?.('lifeControl')?.domains ?? [];
   const fromDomains = [];
   const seen = new Set();

   for (const domain of domains) {
      const color = (domain.color ?? '').trim().toLowerCase();
      if (!color || seen.has(color)) {
         continue;
      }
      seen.add(color);
      fromDomains.push(domain.color);
   }

   return fromDomains.length > 0 ? fromDomains : FALLBACK_NOTE_COLORS;
}

/** @deprecated Prefer getNoteColors(); se mantiene por compatibilidad. */
export const NOTE_COLORS = FALLBACK_NOTE_COLORS;
