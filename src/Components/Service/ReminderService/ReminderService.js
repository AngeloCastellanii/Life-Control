import { notificationPermission } from '../../AppComponents/sections/notifications.js';

const CHECK_INTERVAL_MS = 60 * 1000;

function showInAppToast({ title, body, route }) {
   let host = document.querySelector('.lc-toast-host');
   if (!host) {
      host = document.createElement('div');
      host.className = 'lc-toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
   }

   const toast = document.createElement('button');
   toast.type = 'button';
   toast.className = 'lc-toast';
   toast.innerHTML = `<strong class="lc-toast__title"></strong><span class="lc-toast__body"></span>`;
   toast.querySelector('.lc-toast__title').textContent = title;
   toast.querySelector('.lc-toast__body').textContent = body;
   toast.addEventListener('click', () => {
      if (route) {
         slice.router?.navigate?.(route);
      }
      toast.remove();
   });
   host.appendChild(toast);
   setTimeout(() => toast.remove(), 8000);
}

export default class ReminderService {
   async init() {
      this.notesService = slice.getComponent('notes-service');
      this.taskService = slice.getComponent('task-service');
      this._timer = null;
      this._wakeLock = null;
      this.start();

      document.addEventListener('visibilitychange', () => {
         if (document.visibilityState === 'visible') {
            this.requestWakeLock();
            this.check();
         } else {
            this.releaseWakeLock();
         }
      });

      slice.events.subscribe('note:changed', () => this.check());
      slice.events.subscribe('task:changed', () => this.check());
      slice.events.subscribe('reminder:inapp', (payload) => {
         showInAppToast({
            title: payload?.title || 'Recordatorio',
            body: payload?.body || '',
            route: payload?.route || '/notes'
         });
      });

      await this.requestWakeLock();
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
      this.releaseWakeLock();
   }

   async requestWakeLock() {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') {
         return;
      }
      try {
         this._wakeLock = await navigator.wakeLock.request('screen');
         this._wakeLock.addEventListener('release', () => {
            this._wakeLock = null;
         });
      } catch {
         /* no disponible / denegado */
      }
   }

   releaseWakeLock() {
      try {
         this._wakeLock?.release?.();
      } catch {
         /* ignore */
      }
      this._wakeLock = null;
   }

   async check() {
      await this.checkNotes();
      await this.checkTasks();
   }

   async checkNotes() {
      const notesService = this.notesService ?? slice.getComponent('notes-service');
      if (!notesService?.getDueReminders) {
         return;
      }

      const due = notesService.getDueReminders();
      for (const note of due) {
         const delivered = this.notify({
            title: note.title || 'Recordatorio',
            body: note.body
               ? note.body.slice(0, 120)
               : 'Tienes un recordatorio en Life Control.',
            tag: `lc-note-${note.id}`,
            route: '/notes'
         });
         if (delivered) {
            await notesService.markNotified(note.id);
         }
      }

      if (due.length > 0) {
         slice.events.emit('reminder:due', { notes: due });
      }
   }

   async checkTasks() {
      const taskService = this.taskService ?? slice.getComponent('task-service');
      if (!taskService?.getDueReminders) {
         return;
      }

      const due = taskService.getDueReminders();
      for (const task of due) {
         const delivered = this.notify({
            title: task.title || 'Tarea pendiente',
            body: 'Tienes una tarea del planificador que vence hoy.',
            tag: `lc-task-${task.id}`,
            route: '/planner'
         });
         if (delivered) {
            await taskService.markDueNotified(task.id);
         }
      }

      if (due.length > 0) {
         slice.events.emit('reminder:tasks-due', { tasks: due });
      }
   }

   notify({ title, body, tag, route }) {
      if (notificationPermission() === 'granted') {
         try {
            const notification = new Notification(`⏰ ${title}`, {
               body,
               tag,
               icon: '/images/icon-192.png',
               badge: '/images/icon-192.png',
               requireInteraction: true
            });
            notification.onclick = () => {
               window.focus();
               slice.router?.navigate?.(route);
               notification.close();
            };
            return true;
         } catch {
            /* fallback abajo */
         }
      }

      slice.events.emit('reminder:inapp', { title, body, route });
      return true;
   }
}
