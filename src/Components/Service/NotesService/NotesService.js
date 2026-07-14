import { NOTE_COLORS } from '../../AppComponents/sections/noteColors.js';

const STORE = 'notes';

function nowISO() {
   return new Date().toISOString();
}

function normalizeNote(note) {
   return {
      id: note.id,
      title: (note.title ?? '').trim(),
      body: note.body ?? '',
      color: note.color ?? NOTE_COLORS[0],
      pinned: Boolean(note.pinned),
      remindAt: note.remindAt ?? null,
      notified: Boolean(note.notified),
      createdAt: note.createdAt ?? nowISO(),
      updatedAt: note.updatedAt ?? note.createdAt ?? nowISO()
   };
}

function compareNotes(a, b) {
   if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
   }
   if (a.remindAt && b.remindAt && a.remindAt !== b.remindAt) {
      return a.remindAt.localeCompare(b.remindAt);
   }
   if (Boolean(a.remindAt) !== Boolean(b.remindAt)) {
      return a.remindAt ? -1 : 1;
   }
   return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

export default class NotesService {
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
      const notes = (await this.storage.getAll(STORE)).map(normalizeNote);
      notes.sort(compareNotes);

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         notes
      }));
   }

   getAll() {
      return (slice.context.getState('lifeControl')?.notes ?? []).map(normalizeNote);
   }

   getById(id) {
      return this.getAll().find((note) => note.id === id) ?? null;
   }

   async create({ title, body, color, remindAt, pinned }) {
      const trimmedTitle = title?.trim() ?? '';
      const trimmedBody = body?.trim() ?? '';
      if (!trimmedTitle && !trimmedBody) {
         return null;
      }

      const note = normalizeNote({
         id: crypto.randomUUID(),
         title: trimmedTitle || 'Nota',
         body: trimmedBody,
         color: color || NOTE_COLORS[0],
         pinned: Boolean(pinned),
         remindAt: remindAt || null,
         notified: false,
         createdAt: nowISO(),
         updatedAt: nowISO()
      });

      await this.storage.put(STORE, note);
      await this.syncToContext();
      slice.events.emit('note:changed', { action: 'create', note });
      return note;
   }

   async update(id, patch) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const remindChanged = patch.remindAt !== undefined && patch.remindAt !== existing.remindAt;

      const updated = normalizeNote({
         ...existing,
         ...patch,
         id,
         notified: remindChanged ? false : existing.notified,
         updatedAt: nowISO()
      });

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('note:changed', { action: 'update', note: updated });
      return updated;
   }

   async togglePinned(id) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      return this.update(id, { pinned: !existing.pinned });
   }

   async markNotified(id) {
      const existing = this.getById(id);
      if (!existing || existing.notified) {
         return null;
      }
      const updated = normalizeNote({ ...existing, notified: true });
      await this.storage.put(STORE, updated);
      await this.syncToContext();
      return updated;
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('note:changed', { action: 'delete', id });
      return true;
   }

   /** Notas con recordatorio vencido y aún no notificadas. */
   getDueReminders(reference = new Date()) {
      const nowStamp = reference.getTime();
      return this.getAll().filter((note) => {
         if (!note.remindAt || note.notified) {
            return false;
         }
         const when = new Date(note.remindAt).getTime();
         return Number.isFinite(when) && when <= nowStamp;
      });
   }

   /** Notas con recordatorio futuro dentro de las próximas horas/días. */
   getUpcomingReminders({ withinHours = 48 } = {}) {
      const now = Date.now();
      const limit = now + withinHours * 60 * 60 * 1000;
      return this.getAll()
         .filter((note) => {
            if (!note.remindAt) {
               return false;
            }
            const when = new Date(note.remindAt).getTime();
            return Number.isFinite(when) && when >= now && when <= limit;
         })
         .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
   }
}
