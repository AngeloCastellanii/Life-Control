import { taskInBlockOnDay, taskShowsOnCalendarDay, todayISO } from '../../sections/plannerDates.js';
import { formatDuration } from '../../../Utils/formatDuration.js';
import { formatBlockRangeLabel } from '../../../Utils/taskSlotTimes.js';
import { enableDockDrag, mountInDock } from '../../sections/floatDock.js';

function toMinutes(hhmm) {
   const [h, m] = String(hhmm ?? '0:0').split(':').map(Number);
   return (h || 0) * 60 + (m || 0);
}

function currentBlock(blocks, nowMinutes) {
   for (const block of blocks) {
      const start = toMinutes(block.start);
      let end = toMinutes(block.end);
      if (end <= start) {
         end += 24 * 60;
      }
      if (nowMinutes >= start && nowMinutes < end) {
         return block;
      }
      if (nowMinutes + 24 * 60 >= start && nowMinutes + 24 * 60 < end) {
         return block;
      }
   }
   return null;
}

function nextBlock(blocks, nowMinutes) {
   const upcoming = blocks
      .filter((block) => toMinutes(block.start) > nowMinutes)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
   return upcoming[0] ?? null;
}

function atToday(hhmm, dayOffset = 0) {
   const [h, m] = String(hhmm ?? '0:0').split(':').map(Number);
   const date = new Date();
   date.setHours(h || 0, m || 0, 0, 0);
   if (dayOffset) {
      date.setDate(date.getDate() + dayOffset);
   }
   return date;
}

function blockEndDate(block, now) {
   const start = atToday(block.start);
   let end = atToday(block.end);
   if (end <= start) {
      end = atToday(block.end, 1);
   }
   if (now < start && end < now) {
      end.setDate(end.getDate() + 1);
   }
   return end;
}

function formatCountdown(ms) {
   const total = Math.max(0, Math.floor(ms / 1000));
   const hours = Math.floor(total / 3600);
   const minutes = Math.floor((total % 3600) / 60);
   const seconds = total % 60;
   if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
   }
   return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default class FocusOverlay extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'focus-overlay' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$toggle = this.querySelector('[data-role="toggle"]');
      this.$panel = this.querySelector('[data-role="panel"]');
      this.$close = this.querySelector('[data-role="close"]');
      this.$clock = this.querySelector('[data-role="clock"]');
      this.$remain = this.querySelector('[data-role="remain"]');
      this.$caption = this.querySelector('[data-role="caption"]');
      this.$label = this.querySelector('[data-role="block-label"]');
      this.$range = this.querySelector('[data-role="block-range"]');
      this.$progress = this.querySelector('[data-role="progress"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this._open = false;
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.taskService = slice.getComponent('task-service');
      mountInDock(this, 'prepend');
      enableDockDrag(this.$toggle);
      if (this.$panel && this.$panel.parentElement !== document.body) {
         document.body.appendChild(this.$panel);
      }

      this.$toggle.addEventListener('click', () => {
         if (this.$toggle._dockDidDrag) {
            this.$toggle._dockDidDrag = false;
            return;
         }
         this.setOpen(!this._open);
      });
      this.$close.addEventListener('click', () => this.setOpen(false));
      this._onKey = (event) => {
         if (event.key === 'Escape' && this._open) {
            this.setOpen(false);
         }
      };
      document.addEventListener('keydown', this._onKey);
      slice.events.subscribe('ui:focus:open', () => this.setOpen(true), { component: this });
      slice.events.subscribe('ui:focus:close', () => this.setOpen(false), { component: this });
      slice.context.watch(
         'lifeControl',
         this,
         () => {
            if (this._open) {
               this.render();
            }
         },
         (state) => ({ tasks: state?.tasks ?? [], timeBlocks: state?.timeBlocks ?? [] })
      );
   }

   disconnectedCallback() {
      this.stopTimer();
      document.removeEventListener('keydown', this._onKey);
      document.documentElement.classList.remove('lc-focus-mode');
      this.$panel?.remove();
   }

   setOpen(open) {
      this._open = Boolean(open);
      document.documentElement.classList.toggle('lc-focus-mode', this._open);
      this.$panel.hidden = !this._open;
      this.$toggle.setAttribute('aria-pressed', this._open ? 'true' : 'false');
      this.$toggle.setAttribute('aria-expanded', this._open ? 'true' : 'false');
      this.$toggle.setAttribute(
         'aria-label',
         this._open ? 'Salir del modo enfoque' : 'Activar modo enfoque'
      );
      this.$toggle.classList.toggle('lc-focus-toggle--on', this._open);
      if (this._open) {
         this.render();
         this.startTimer();
         this.$close?.focus?.();
      } else {
         this.stopTimer();
      }
   }

   startTimer() {
      this.stopTimer();
      this._timer = setInterval(() => this.render(), 1000);
   }

   stopTimer() {
      if (this._timer) {
         clearInterval(this._timer);
         this._timer = null;
      }
   }

   render() {
      const state = slice.context.getState('lifeControl') ?? {};
      const blocks = state.timeBlocks ?? [];
      const tasks = state.tasks ?? [];
      const now = new Date();
      const today = todayISO();
      this.$clock.textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const live = currentBlock(blocks, nowMinutes);
      const upcoming = live ? null : nextBlock(blocks, nowMinutes);
      const block = live || upcoming;

      let focusTasks = [];
      if (block) {
         this.$remain.hidden = false;
         this.$caption.hidden = false;
         this.$label.textContent = block.label;
         this.$range.textContent = formatBlockRangeLabel(block.start, block.end);
         if (live) {
            this.$caption.textContent = 'Quedan';
            this.$remain.textContent = formatCountdown(blockEndDate(block, now) - now);
         } else {
            const start = atToday(block.start);
            this.$caption.textContent = 'Empieza en';
            this.$remain.textContent = formatCountdown(start - now);
         }
         focusTasks = tasks.filter((task) => task.blockId === block.id && taskInBlockOnDay(task, today));
      } else {
         this.$remain.hidden = true;
         this.$caption.hidden = true;
         this.$label.textContent = 'Hoy';
         this.$range.textContent = '';
         focusTasks = tasks.filter((task) => !task.completed && taskShowsOnCalendarDay(task, today));
      }

      focusTasks.sort((a, b) => (a.slotStart ?? '').localeCompare(b.slotStart ?? ''));
      this.renderTasks(focusTasks);
   }

   renderTasks(blockTasks) {
      this.$tasks.innerHTML = '';
      const pending = blockTasks.filter((task) => !task.completed);
      const done = blockTasks.filter((task) => task.completed);
      const total = blockTasks.length;
      const completed = done.length;
      this.$progress.hidden = total === 0;
      this.$progress.textContent = total ? `${completed} / ${total}` : '';
      this.$empty.hidden = total > 0;
      this.$empty.textContent = 'Nada pendiente.';

      const ordered = [...pending, ...done];
      const currentId = pending[0]?.id;

      for (const task of ordered) {
         const li = document.createElement('li');
         li.className = 'lc-focus-task';
         if (task.completed) {
            li.classList.add('lc-focus-task--done');
         }
         if (task.id === currentId) {
            li.classList.add('lc-focus-task--now');
         }

         const mark = document.createElement('input');
         mark.type = 'checkbox';
         mark.className = 'lc-focus-task__done';
         mark.checked = Boolean(task.completed);
         mark.setAttribute('aria-label', `Completar ${task.title}`);
         mark.addEventListener('click', (event) => event.stopPropagation());
         mark.addEventListener('change', () => {
            this.taskService?.toggleComplete(task.id, mark.checked);
         });

         const info = document.createElement('div');
         info.className = 'lc-focus-task__info';
         const title = document.createElement('span');
         title.className = 'lc-focus-task__title';
         title.textContent = task.title;
         info.appendChild(title);
         if (task.minutes) {
            const meta = document.createElement('span');
            meta.className = 'lc-focus-task__meta';
            meta.textContent = formatDuration(task.minutes, { short: true });
            info.appendChild(meta);
         }

         li.append(mark, info);
         li.addEventListener('click', () => {
            this.taskService?.toggleComplete(task.id, !task.completed);
         });
         this.$tasks.appendChild(li);
      }
   }
}

customElements.define('slice-focus-overlay', FocusOverlay);
