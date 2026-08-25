import {
   notificationPermission,
   notificationsSupported,
   requestNotificationPermission
} from '../notifications.js';

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
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.notesService = slice.getComponent('notes-service');
      if (!this.notesService) {
         slice.logger?.logError?.('NotesSection', 'NotesService no disponible');
         return;
      }

      this.$enableNotifications.addEventListener('click', () => this.enableNotifications());

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderList(),
         (state) => ({ notes: state?.notes ?? [] })
      );

      this.syncReminderCta();
      this.renderList();
   }

   syncReminderCta() {
      const notes = this.notesService.getAll();
      const hasReminders = notes.some((note) => note.remindAt);
      const shouldAsk =
         notificationsSupported() && notificationPermission() === 'default' && hasReminders;
      this.$reminderCta.hidden = !shouldAsk;
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
      if (!note) {
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
         ? 'Escribe un ítem. Varias líneas se añaden como ítems separados.'
         : 'Escribe solo lo nuevo. Se anexará al final de la nota.';

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
      input.placeholder = isList ? 'Leche\nPan' : 'Lo que quieras recordar…';

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
      this.$list.innerHTML = '';

      const hasItems = notes.length > 0;
      this.$empty.hidden = hasItems;
      this.syncReminderCta();

      const now = Date.now();

      for (const note of notes) {
         const card = document.createElement('article');
         card.className = 'notes-section__card lc-card';
         card.style.setProperty('--note-accent', note.color);
         if (note.pinned) {
            card.classList.add('notes-section__card--pinned');
         }

         const head = document.createElement('div');
         head.className = 'notes-section__card-head';

         const title = document.createElement('h3');
         title.className = 'notes-section__card-title';
         title.textContent = note.title;

         const pinBtn = document.createElement('button');
         pinBtn.type = 'button';
         pinBtn.className = 'notes-section__pin';
         pinBtn.classList.toggle('notes-section__pin--active', note.pinned);
         pinBtn.textContent = note.pinned ? '★' : '☆';
         pinBtn.setAttribute('aria-label', note.pinned ? 'Desfijar' : 'Fijar');
         pinBtn.addEventListener('click', () => this.notesService.togglePinned(note.id));

         head.append(title, pinBtn);
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
               check.setAttribute('aria-label', item.done ? 'Marcar pendiente' : 'Marcar hecho');
               check.textContent = item.done ? '✓' : '';
               check.addEventListener('click', () =>
                  this.notesService.toggleChecklistItem(note.id, item.id)
               );

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

         if (note.remindAt) {
            const badge = document.createElement('span');
            badge.className = 'notes-section__reminder';
            const overdue = new Date(note.remindAt).getTime() <= now;
            badge.classList.toggle('notes-section__reminder--overdue', overdue && !note.notified);
            badge.textContent = `⏰ ${formatReminder(note.remindAt)}`;
            card.appendChild(badge);
         }

         const actions = document.createElement('div');
         actions.className = 'notes-section__actions';

         const addBtn = document.createElement('button');
         addBtn.type = 'button';
         addBtn.className = 'notes-section__add';
         addBtn.textContent = 'Agregar';
         addBtn.setAttribute(
            'aria-label',
            note.type === 'list' ? `Añadir ítem a ${note.title}` : `Añadir contenido a ${note.title}`
         );
         addBtn.addEventListener('click', () => this.openAppend(note.id));

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'notes-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.addEventListener('click', () => this.openEdit(note.id));

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'notes-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar esta nota?')) {
               this.notesService.remove(note.id);
            }
         });

         actions.append(addBtn, editBtn, deleteBtn);
         card.appendChild(actions);

         this.$list.appendChild(card);
      }
   }
}

customElements.define('slice-notes-section', NotesSection);
