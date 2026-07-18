import { getNoteColors } from '../../AppComponents/sections/noteColors.js';

const STORE = 'notes';

function nowISO() {
   return new Date().toISOString();
}

function normalizeChecklist(items) {
   if (!Array.isArray(items)) {
      return [];
   }
   return items
      .map((item) => ({
         id: item.id || crypto.randomUUID(),
         text: (item.text ?? '').trim(),
         done: Boolean(item.done)
      }))
      .filter((item) => item.text.length > 0);
}

function normalizeNote(note) {
   const type = note.type === 'list' ? 'list' : 'text';
   const checklist = type === 'list' ? normalizeChecklist(note.checklist) : [];
   const colors = getNoteColors();

   return {
      id: note.id,
      title: (note.title ?? '').trim(),
      body: note.body ?? '',
      type,
      checklist,
      color: note.color ?? colors[0],
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

function hasContent(note) {
   if (note.type === 'list') {
      return note.checklist.length > 0 || Boolean(note.title?.trim());
   }
   return Boolean(note.title?.trim() || note.body?.trim());
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

   async create({ title, body, type, checklist, color, remindAt, pinned }) {
      const colors = getNoteColors();
      const note = normalizeNote({
         id: crypto.randomUUID(),
         title: title?.trim() || (type === 'list' ? 'Lista' : 'Nota'),
         body: body ?? '',
         type: type === 'list' ? 'list' : 'text',
         checklist: checklist ?? [],
         color: color || colors[0],
         pinned: Boolean(pinned),
         remindAt: remindAt || null,
         notified: false,
         createdAt: nowISO(),
         updatedAt: nowISO()
      });

      if (!hasContent(note)) {
         return null;
      }

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

      if (!hasContent(updated)) {
         return null;
      }

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

   async toggleChecklistItem(noteId, itemId) {
      const existing = this.getById(noteId);
      if (!existing || existing.type !== 'list') {
         return null;
      }
      const checklist = existing.checklist.map((item) =>
         item.id === itemId ? { ...item, done: !item.done } : item
      );
      return this.update(noteId, { checklist });
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
