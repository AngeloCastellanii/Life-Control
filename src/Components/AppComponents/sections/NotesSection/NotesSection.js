import {
   notificationPermission,
   notificationsSupported,
   requestNotificationPermission
} from '../notifications.js';

const ICON_ARCHIVE =
   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M10 12h4" stroke-linecap="round"/></svg>';
const ICON_RESTORE =
   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" stroke-linecap="round"/><path d="M3 4v5h5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function formatReminder(iso) {
   const date = new Date(iso);
   if (Number.isNaN(date.getTime())) {
      return '';
   }
   return date.toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
   });
}

function isListComplete(note) {
   return (
      note.type === 'list' &&
      Array.isArray(note.checklist) &&
      note.checklist.length > 0 &&
      note.checklist.every((item) => item.done)
   );
}

export default class NotesSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'notes-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$list = this.querySelector('[data-role="list"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$reminderCta = this.querySelector('[data-role="reminder-cta"]');
      this.$enableNotifications = this.querySelector('[data-role="enable-notifications"]');
      this.$filters = this.querySelectorAll('[data-filter]');
      this._view = 'active';
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.notesService = slice.getComponent('notes-service');
      if (!this.notesService) {
         slice.logger?.logError?.('NotesSection', 'NotesService no disponible');
         return;
      }

      this.$enableNotifications.addEventListener('click', () => this.enableNotifications());

      for (const button of this.$filters) {
         button.addEventListener('click', () => this.setView(button.dataset.filter));
      }

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderList(),
         (state) => ({ notes: state?.notes ?? [] })
      );

      this.syncReminderCta();
      this.syncFilters();
      this.renderList();
   }

   setView(view) {
      this._view = view === 'archived' ? 'archived' : 'active';
      this.syncFilters();
      this.renderList();
   }

   syncFilters() {
      const archivedCount = (this.notesService?.getAll?.() ?? []).filter((note) => note.archived).length;
      for (const button of this.$filters) {
         const active = button.dataset.filter === this._view;
         button.classList.toggle('notes-section__filter--active', active);
         button.setAttribute('aria-selected', active ? 'true' : 'false');
         if (button.dataset.filter === 'archived') {
            button.textContent = archivedCount ? `Archivadas (${archivedCount})` : 'Archivadas';
         }
      }
   }

   syncReminderCta() {
      const notes = this.notesService.getAll();
      const hasReminders = notes.some((note) => note.remindAt && !note.archived);
      const shouldAsk =
         notificationsSupported() && notificationPermission() === 'default' && hasReminders;
      this.$reminderCta.hidden = !shouldAsk || this._view === 'archived';
   }

   async enableNotifications() {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
         slice.getComponent('reminder-service')?.check?.();
      }
      this.syncReminderCta();
   }

   openEdit(noteId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar nota',
         form: 'NoteForm',
         noteId
      });
   }

   closeAppend() {
      if (this.$appendDialog?.open) {
         this.$appendDialog.close();
      }
      this.$appendDialog?.remove();
      this.$appendDialog = null;
   }

   openAppend(noteId) {
      const note = this.notesService.getById(noteId);
      if (!note || note.archived) {
         return;
      }

      this.closeAppend();

      const isList = note.type === 'list';
      const dialog = document.createElement('dialog');
      dialog.className = 'notes-section__append-dialog';
      dialog.setAttribute('aria-labelledby', 'notes-append-title');
      dialog.setAttribute('aria-describedby', 'notes-append-hint');

      const title = document.createElement('h2');
      title.id = 'notes-append-title';
      title.className = 'notes-section__append-title';
      title.textContent = isList ? 'Añadir ítem' : 'Añadir a la nota';

      const hint = document.createElement('p');
      hint.id = 'notes-append-hint';
      hint.className = 'notes-section__append-hint';
      hint.textContent = isList
         ? 'Un ítem por línea.'
         : 'Se anexa al final de la nota.';

      const form = document.createElement('form');
      form.className = 'notes-section__append-form';
      form.method = 'dialog';

      const label = document.createElement('label');
      label.className = 'lc-label';
      label.setAttribute('for', 'notes-append-input');
      label.textContent = isList ? 'Nuevo ítem' : 'Texto a añadir';

      const input = document.createElement('textarea');
      input.id = 'notes-append-input';
      input.className = 'lc-input notes-section__append-input';
      input.rows = 3;
      input.required = true;
      input.setAttribute('aria-required', 'true');
      input.placeholder = '';

      const error = document.createElement('p');
      error.className = 'notes-section__append-error';
      error.hidden = true;
      error.setAttribute('role', 'alert');

      const actions = document.createElement('div');
      actions.className = 'notes-section__append-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'lc-btn-outline';
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.addEventListener('click', () => this.closeAppend());

      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.className = 'notes-section__append-submit';
      submitBtn.textContent = 'Añadir';

      actions.append(cancelBtn, submitBtn);
      form.append(label, input, error, actions);

      const onKeyDown = (event) => {
         if (event.key === 'Escape') {
            event.preventDefault();
            this.closeAppend();
         }
         if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            form.requestSubmit();
         }
      };

      form.addEventListener('submit', async (event) => {
         event.preventDefault();
         const value = input.value.trim();
         if (!value) {
            error.hidden = false;
            error.textContent = 'Escribe algo para añadir.';
            input.focus();
            return;
         }

         submitBtn.disabled = true;
         const saved = await this.notesService.appendContent(note.id, value);
         if (!saved) {
            submitBtn.disabled = false;
            error.hidden = false;
            error.textContent = 'No se pudo añadir.';
            input.focus();
            return;
         }

         this.closeAppend();
      });

      dialog.append(title, hint, form);
      dialog.addEventListener('keydown', onKeyDown);
      dialog.addEventListener('cancel', (event) => {
         event.preventDefault();
         this.closeAppend();
      });
      dialog.addEventListener('click', (event) => {
         if (event.target === dialog) {
            this.closeAppend();
         }
      });

      this.$appendDialog = dialog;
      this.appendChild(dialog);
      dialog.showModal();
      input.focus();
   }

   renderList() {
      const notes = this.notesService.getAll();
      const showArchived = this._view === 'archived';
      const visible = notes.filter((note) => Boolean(note.archived) === showArchived);
      this.$list.innerHTML = '';

      this.$empty.hidden = visible.length > 0;
      this.$empty.textContent = showArchived ? 'Nada archivado.' : 'Sin notas. Pulsa +.';
      this.syncReminderCta();
      this.syncFilters();

      const now = Date.now();

      for (const note of visible) {
         const card = document.createElement('article');
         card.className = 'notes-section__card lc-card';
         card.style.setProperty('--note-accent', note.color);
         if (note.pinned) {
            card.classList.add('notes-section__card--pinned');
         }
         if (note.archived) {
            card.classList.add('notes-section__card--archived');
         }

         const head = document.createElement('div');
         head.className = 'notes-section__card-head';

         const title = document.createElement('h3');
         title.className = 'notes-section__card-title';
         title.textContent = note.title;

         const headActions = document.createElement('div');
         headActions.className = 'notes-section__head-actions';

         if (!note.archived) {
            const pinBtn = document.createElement('button');
            pinBtn.type = 'button';
            pinBtn.className = 'notes-section__pin';
            pinBtn.classList.toggle('notes-section__pin--active', note.pinned);
            pinBtn.textContent = note.pinned ? '★' : '☆';
            pinBtn.setAttribute('aria-label', note.pinned ? 'Desfijar' : 'Fijar');
            pinBtn.addEventListener('click', () => this.notesService.togglePinned(note.id));
            headActions.appendChild(pinBtn);
         }

         const archiveBtn = document.createElement('button');
         archiveBtn.type = 'button';
         archiveBtn.className = 'notes-section__archive';
         const complete = isListComplete(note);
         archiveBtn.classList.toggle('notes-section__archive--ready', complete && !note.archived);
         archiveBtn.innerHTML = note.archived ? ICON_RESTORE : ICON_ARCHIVE;
         archiveBtn.setAttribute(
            'aria-label',
            note.archived ? 'Restaurar' : complete ? 'Archivar lista completada' : 'Archivar'
         );
         archiveBtn.title = note.archived ? 'Restaurar' : 'Archivar';
         archiveBtn.addEventListener('click', () => this.notesService.toggleArchived(note.id));
         headActions.appendChild(archiveBtn);

         head.append(title, headActions);
         card.appendChild(head);

         if (note.type === 'list' && note.checklist?.length) {
            const checklist = document.createElement('ol');
            checklist.className = 'notes-section__checklist';
            note.checklist.forEach((item, index) => {
               const li = document.createElement('li');
               li.className = 'notes-section__check-item';
               if (item.done) {
                  li.classList.add('notes-section__check-item--done');
               }

               const num = document.createElement('span');
               num.className = 'notes-section__check-num';
               num.textContent = `${index + 1}.`;

               const check = document.createElement('button');
               check.type = 'button';
               check.className = 'notes-section__check';
               check.disabled = Boolean(note.archived);
               check.setAttribute('aria-label', item.done ? 'Marcar pendiente' : 'Marcar hecho');
               check.textContent = item.done ? '✓' : '';
               if (!note.archived) {
                  check.addEventListener('click', () =>
                     this.notesService.toggleChecklistItem(note.id, item.id)
                  );
               }

               const text = document.createElement('span');
               text.className = 'notes-section__check-text';
               text.textContent = item.text;

               li.append(num, check, text);
               checklist.appendChild(li);
            });
            card.appendChild(checklist);
         } else if (note.body) {
            const body = document.createElement('p');
            body.className = 'notes-section__card-body';
            body.textContent = note.body;
            card.appendChild(body);
         }

         if (note.remindAt && !note.archived) {
            const badge = document.createElement('span');
            badge.className = 'notes-section__reminder';
            const overdue = new Date(note.remindAt).getTime() <= now;
            badge.classList.toggle('notes-section__reminder--overdue', overdue && !note.notified);
            badge.textContent = `⏰ ${formatReminder(note.remindAt)}`;
            card.appendChild(badge);
         }

         const actions = document.createElement('div');
         actions.className = 'notes-section__actions';

         if (note.archived) {
            const restoreBtn = document.createElement('button');
            restoreBtn.type = 'button';
            restoreBtn.className = 'notes-section__add';
            restoreBtn.textContent = 'Restaurar';
            restoreBtn.addEventListener('click', () => this.notesService.toggleArchived(note.id));
            actions.appendChild(restoreBtn);
         } else {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'notes-section__add';
            addBtn.textContent = 'Agregar';
            addBtn.setAttribute(
               'aria-label',
               note.type === 'list' ? `Añadir ítem a ${note.title}` : `Añadir contenido a ${note.title}`
            );
            addBtn.addEventListener('click', () => this.openAppend(note.id));
            actions.appendChild(addBtn);
         }

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'notes-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.disabled = Boolean(note.archived);
         if (!note.archived) {
            editBtn.addEventListener('click', () => this.openEdit(note.id));
         }

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'notes-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar esta nota?')) {
               this.notesService.remove(note.id);
            }
         });

         actions.append(editBtn, deleteBtn);
         card.appendChild(actions);

         this.$list.appendChild(card);
      }
   }
}

customElements.define('slice-notes-section', NotesSection);
