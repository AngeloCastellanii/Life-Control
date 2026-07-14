import { notificationPermission } from '../../AppComponents/sections/notifications.js';

const CHECK_INTERVAL_MS = 60 * 1000;

export default class ReminderService {
   async init() {
      this.notesService = slice.getComponent('notes-service');
      this._timer = null;
      this.start();

      document.addEventListener('visibilitychange', () => {
         if (document.visibilityState === 'visible') {
            this.check();
         }
      });

      slice.events.subscribe('note:changed', () => this.check());
      await this.check();
   }

   start() {
      if (this._timer) {
         return;
      }
      this._timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
   }

   stop() {
      if (this._timer) {
         clearInterval(this._timer);
         this._timer = null;
      }
   }

   async check() {
      const notesService = this.notesService ?? slice.getComponent('notes-service');
      if (!notesService?.getDueReminders) {
         return;
      }

      const due = notesService.getDueReminders();
      if (due.length === 0) {
         return;
      }

      for (const note of due) {
         this.notify(note);
         await notesService.markNotified(note.id);
      }

      slice.events.emit('reminder:due', { notes: due });
   }

   notify(note) {
      const title = note.title || 'Recordatorio';
      const body = note.body ? note.body.slice(0, 120) : 'Tienes un recordatorio en Life Control.';

      if (notificationPermission() === 'granted') {
         try {
            const notification = new Notification(`⏰ ${title}`, {
               body,
               tag: `lc-note-${note.id}`,
               icon: '/images/icon-192.png',
               badge: '/images/icon-192.png'
            });
            notification.onclick = () => {
               window.focus();
               slice.router?.navigate?.('/notes');
               notification.close();
            };
            return;
         } catch {
            /* fallback abajo */
         }
      }

      slice.events.emit('reminder:inapp', { note, title, body });
   }
}
