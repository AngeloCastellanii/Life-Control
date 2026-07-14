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

         if (note.body) {
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

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'notes-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.addEventListener('click', () => this.openEdit(note.id));

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'notes-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', () => this.notesService.remove(note.id));

         actions.append(editBtn, deleteBtn);
         card.appendChild(actions);

         this.$list.appendChild(card);
      }
   }
}

customElements.define('slice-notes-section', NotesSection);
