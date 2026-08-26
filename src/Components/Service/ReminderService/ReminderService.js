import {
   addNotificationToInbox,
   dismissInboxItem,
   getServiceWorkerRegistration,
   notificationPermission,
   readNotificationInbox,
   showOsNotification,
   unreadNotificationCount
} from '../../AppComponents/sections/notifications.js';
import { getDueStatus } from '../../AppComponents/sections/shoppingDue.js';
import { todayISO } from '../../AppComponents/sections/plannerDates.js';
import { isHabitDueOn } from '../HabitsService/HabitsService.js';

const CHECK_INTERVAL_MS = 30 * 1000;
const JUST_DUE_MS = 2 * 60 * 1000;
const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

function padTime(value) {
   return String(value).padStart(2, '0');
}

function atDateTime(isoDate, hhmm) {
   const [h, m] = String(hhmm || `${padTime(DEFAULT_HOUR)}:${padTime(DEFAULT_MINUTE)}`).split(':');
   const stamp = new Date(`${isoDate}T${padTime(Number(h) || 0)}:${padTime(Number(m) || 0)}:00`).getTime();
   return Number.isFinite(stamp) ? stamp : NaN;
}

function digestBody(items) {
   const titles = items.map((item) => item.title).filter(Boolean);
   if (titles.length === 0) {
      return 'Tienes actividades pendientes en Life Control.';
   }
   if (titles.length === 1) {
      return `Oye, tienes pendiente ${titles[0]}.`;
   }
   if (titles.length === 2) {
      return `Oye, tienes pendientes: ${titles[0]} y ${titles[1]}.`;
   }
   return `Oye, tienes ${titles.length} actividades pendientes: ${titles.slice(0, 3).join(', ')}${
      titles.length > 3 ? '…' : '.'
   }`;
}

function ensureInboxUi() {
   let root = document.querySelector('.lc-notice-root');
   if (root) {
      return root;
   }

   root = document.createElement('div');
   root.className = 'lc-notice-root';
   root.innerHTML = `
      <button type="button" class="lc-notice-toggle" data-role="toggle" hidden aria-expanded="false">
         <span data-role="badge">0</span>
         <span>Avisos</span>
      </button>
      <div class="lc-notice-panel" data-role="panel" hidden>
         <div class="lc-notice-panel__head">
            <strong>Avisos</strong>
            <button type="button" class="lc-notice-panel__close" data-role="close" aria-label="Cerrar avisos">Cerrar</button>
         </div>
         <ul class="lc-notice-panel__list" data-role="list"></ul>
         <p class="lc-notice-panel__empty" data-role="empty" hidden>No hay avisos.</p>
      </div>
   `;
   document.body.appendChild(root);

   const toggle = root.querySelector('[data-role="toggle"]');
   const panel = root.querySelector('[data-role="panel"]');
   const close = root.querySelector('[data-role="close"]');
   const setOpen = (open) => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
   };
   toggle.addEventListener('click', () => setOpen(panel.hidden));
   close.addEventListener('click', () => setOpen(false));
   return root;
}

function renderInboxUi() {
   const root = ensureInboxUi();
   const items = readNotificationInbox();
   const unread = unreadNotificationCount();
   const toggle = root.querySelector('[data-role="toggle"]');
   const list = root.querySelector('[data-role="list"]');
   const empty = root.querySelector('[data-role="empty"]');
   const badge = root.querySelector('[data-role="badge"]');

   toggle.hidden = items.length === 0;
   badge.textContent = String(unread || items.length);
   list.innerHTML = '';
   empty.hidden = items.length > 0;

   for (const item of items.slice(0, 12)) {
      const li = document.createElement('li');
      li.className = 'lc-notice-item';
      if (!item.read) {
         li.classList.add('lc-notice-item--unread');
      }

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'lc-notice-item__open';
      open.innerHTML = `<strong></strong><span></span>`;
      open.querySelector('strong').textContent = item.title;
      open.querySelector('span').textContent = item.body;
      open.addEventListener('click', () => {
         if (item.route) {
            slice.router?.navigate?.(item.route);
         }
         dismissInboxItem(item.id);
         renderInboxUi();
      });

      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'lc-notice-item__dismiss';
      dismiss.setAttribute('aria-label', 'Descartar aviso');
      dismiss.textContent = '×';
      dismiss.addEventListener('click', (event) => {
         event.stopPropagation();
         dismissInboxItem(item.id);
         renderInboxUi();
      });

      li.append(open, dismiss);
      list.appendChild(li);
   }
}

export default class ReminderService {
   async init() {
      this.notesService = slice.getComponent('notes-service');
      this.taskService = slice.getComponent('task-service');
      this.shoppingService = slice.getComponent('shopping-service');
      this.habitsService = slice.getComponent('habits-service');
      this._timer = null;
      this._wakeLock = null;
      this._timeouts = new Map();
      this._delivered = new Set();
      this._readyAt = Date.now();

      renderInboxUi();
      slice.events.subscribe('reminder:inbox-changed', () => renderInboxUi());

      document.addEventListener('visibilitychange', () => {
         if (document.visibilityState === 'visible') {
            this.requestWakeLock();
            this.syncPlan();
         } else {
            this.releaseWakeLock();
            this.flushIfSupported();
         }
      });

      navigator.serviceWorker?.addEventListener('message', (event) => {
         const route = event.data?.route;
         if (event.data?.type === 'NAVIGATE' && route) {
            slice.router?.navigate?.(route);
         }
      });

      slice.events.subscribe('note:changed', () => this.syncPlan());
      slice.events.subscribe('task:changed', () => this.syncPlan());
      slice.events.subscribe('shopping:changed', () => this.syncPlan());
      slice.events.subscribe('habit:changed', () => this.syncPlan());

      this.start();
      await this.requestWakeLock();
      await this.syncPlan();
      await this.registerPeriodicSync();
   }

   start() {
      if (this._timer) {
         return;
      }
      this._timer = setInterval(() => this.checkJustDue(), CHECK_INTERVAL_MS);
   }

   stop() {
      if (this._timer) {
         clearInterval(this._timer);
         this._timer = null;
      }
      for (const timeout of this._timeouts.values()) {
         clearTimeout(timeout);
      }
      this._timeouts.clear();
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

   async registerPeriodicSync() {
      const registration = await getServiceWorkerRegistration();
      if (!registration?.periodicSync) {
         return;
      }
      try {
         await registration.periodicSync.register('lc-reminders', { minInterval: 15 * 60 * 1000 });
      } catch {
         /* no permitido */
      }
   }

   async flushIfSupported() {
      const registration = await getServiceWorkerRegistration();
      registration?.active?.postMessage({ type: 'FLUSH_REMINDERS' });
   }

   collectPlan(reference = new Date()) {
      const today = todayISO();
      const items = [];

      const notes = this.notesService?.getAll?.() ?? [];
      for (const note of notes) {
         if (note.archived || !note.remindAt || note.notified) {
            continue;
         }
         const at = new Date(note.remindAt).getTime();
         if (!Number.isFinite(at)) {
            continue;
         }
         items.push({
            id: `note-${note.id}`,
            at,
            title: note.title || 'Recordatorio',
            body: note.body ? note.body.slice(0, 140) : `Oye, tienes pendiente ${note.title || 'una nota'}.`,
            tag: `lc-note-${note.id}`,
            route: '/notes',
            kind: 'note',
            refId: note.id
         });
      }

      const tasks = this.taskService?.getAll?.() ?? [];
      for (const task of tasks) {
         if (task.completed) {
            continue;
         }
         const due = task.dueDate || task.scheduledDate;
         if (!due || due > today) {
            continue;
         }
         if (task.dueNotifiedDate === today) {
            continue;
         }
         const at = atDateTime(due, task.slotStart || `${padTime(DEFAULT_HOUR)}:${padTime(DEFAULT_MINUTE)}`);
         if (!Number.isFinite(at)) {
            continue;
         }
         items.push({
            id: `task-${task.id}-${today}`,
            at,
            title: task.title || 'Tarea',
            body: `Oye, tienes pendiente ${task.title || 'una tarea'}.`,
            tag: `lc-task-${task.id}-${today}`,
            route: '/planner',
            kind: 'task',
            refId: task.id
         });
      }

      const shopping = this.shoppingService?.getDailyReminderItems?.(reference) ?? [];
      for (const item of shopping) {
         const status = getDueStatus(item);
         const at = atDateTime(today, `${padTime(DEFAULT_HOUR)}:${padTime(DEFAULT_MINUTE)}`);
         items.push({
            id: `shop-${item.id}-${today}`,
            at,
            title: item.name || 'Compra',
            body: `Oye, tienes pendiente ${item.name || 'una compra'} (${status.label}).`,
            tag: `lc-shop-${item.id}-${today}`,
            route: '/shopping',
            kind: 'shop',
            refId: item.id
         });
      }

      const habits = this.habitsService?.getAll?.() ?? [];
      for (const habit of habits) {
         if (!habit.remindAt || habit.paused || !isHabitDueOn(habit, today) || habit.doneDates.includes(today)) {
            continue;
         }
         const at = atDateTime(today, habit.remindAt);
         items.push({
            id: `habit-${habit.id}-${today}`,
            at,
            title: habit.name || 'Hábito',
            body: `Oye, toca ${habit.name || 'tu hábito'} ahora.`,
            tag: `lc-habit-${habit.id}-${today}`,
            route: '/habits',
            kind: 'habit',
            refId: habit.id
         });
      }

      return items.sort((a, b) => a.at - b.at);
   }

   async syncPlan() {
      const items = this.collectPlan();
      const now = Date.now();
      const missed = items.filter((item) => item.at < now - JUST_DUE_MS && !this._delivered.has(item.id));
      const live = items.filter((item) => item.at >= now - JUST_DUE_MS);

      if (missed.length > 0) {
         const digestId = `missed-${todayISO()}`;
         if (!readNotificationInbox().some((entry) => entry.id === digestId)) {
            addNotificationToInbox({
               id: digestId,
               title: 'Pendientes',
               body: digestBody(missed),
               route: missed[0].route
            });
            renderInboxUi();
         }
         for (const item of missed) {
            this._delivered.add(item.id);
            await this.markDelivered(item);
         }
      }

      const registration = await getServiceWorkerRegistration();
      registration?.active?.postMessage({ type: 'SET_REMINDER_PLAN', plan: { items: live } });
      this.scheduleLocalTimeouts(live);
   }

   scheduleLocalTimeouts(items) {
      for (const timeout of this._timeouts.values()) {
         clearTimeout(timeout);
      }
      this._timeouts.clear();

      const now = Date.now();
      for (const item of items) {
         const wait = item.at - now;
         if (wait <= 0 || wait > 24 * 60 * 60 * 1000) {
            continue;
         }
         const timeout = setTimeout(() => {
            this.deliver([item], { reason: 'scheduled' });
         }, wait);
         this._timeouts.set(item.id, timeout);
      }
   }

   checkJustDue() {
      const now = Date.now();
      const due = this.collectPlan().filter((item) => item.at <= now && now - item.at <= JUST_DUE_MS);
      if (due.length > 0) {
         this.deliver(due, { reason: 'window' });
      }
   }

   async check() {
      await this.syncPlan();
      this.checkJustDue();
   }

   async markDelivered(item) {
      if (item.kind === 'note') {
         await this.notesService?.markNotified?.(item.refId);
      } else if (item.kind === 'task') {
         await this.taskService?.markDueNotified?.(item.refId, todayISO());
      } else if (item.kind === 'shop') {
         await this.shoppingService?.markDailyReminder?.(item.refId, todayISO());
      }
   }

   async deliver(items, { reason } = {}) {
      if (!items?.length) {
         return;
      }

      const unique = [];
      const seen = new Set();
      for (const item of items) {
         if (seen.has(item.id) || this._delivered.has(item.id)) {
            continue;
         }
         seen.add(item.id);
         this._delivered.add(item.id);
         unique.push(item);
      }
      if (unique.length === 0) {
         return;
      }

      const startedAgo = Date.now() - this._readyAt;
      const skipOsDump =
         document.visibilityState === 'visible' && startedAgo < 8 * 1000 && reason !== 'scheduled';

      addNotificationToInbox({
         id: unique.length === 1 ? unique[0].id : `digest-${todayISO()}`,
         title: unique.length === 1 ? unique[0].title : 'Actividades pendientes',
         body: digestBody(unique),
         route: unique[0].route
      });
      renderInboxUi();

      if (!skipOsDump) {
         for (const item of unique) {
            await showOsNotification({
               title: item.title || 'Life Control',
               body: item.body || digestBody([item]),
               tag: item.tag || item.id,
               route: item.route || '/'
            });
         }
      }

      for (const item of unique) {
         await this.markDelivered(item);
      }
      await this.syncPlan();
   }
}
