import { taskInBlockOnDay, todayISO } from '../../sections/plannerDates.js';
import { formatDuration } from '../../../Utils/formatDuration.js';
import { formatBlockRangeLabel, formatTaskSlotLabel } from '../../../Utils/taskSlotTimes.js';
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
   return upcoming[0] ?? blocks[0] ?? null;
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
      this.$tag = this.querySelector('[data-role="block-tag"]');
      this.$label = this.querySelector('[data-role="block-label"]');
      this.$range = this.querySelector('[data-role="block-range"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this._selected = new Set();
      this._open = false;
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.taskService = slice.getComponent('task-service');
      mountInDock(this, 'prepend');
      enableDockDrag(this.$toggle);

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
         this._selected = new Set();
         this.render({ seedSelection: true });
         this.startTimer();
         this.$close?.focus?.();
      } else {
         this.stopTimer();
      }
   }

   startTimer() {
      this.stopTimer();
      this._timer = setInterval(() => this.render(), 30 * 1000);
   }

   stopTimer() {
      if (this._timer) {
         clearInterval(this._timer);
         this._timer = null;
      }
   }

   render({ seedSelection = false } = {}) {
      const state = slice.context.getState('lifeControl') ?? {};
      const blocks = state.timeBlocks ?? [];
      const tasks = state.tasks ?? [];
      const now = new Date();
      this.$clock.textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      let block = currentBlock(blocks, nowMinutes);
      let isNow = Boolean(block);
      if (!block) {
         block = nextBlock(blocks, nowMinutes);
      }

      if (!block) {
         this.$tag.textContent = 'Ahora';
         this.$label.textContent = 'Sin bloques';
         this.$range.textContent = '';
         this.$tasks.innerHTML = '';
         this.$empty.hidden = false;
         return;
      }

      this.$tag.textContent = isNow ? 'Ahora' : 'Próximo';
      this.$label.textContent = block.label;
      this.$range.textContent = formatBlockRangeLabel(block.start, block.end);

      const today = todayISO();
      const blockTasks = tasks
         .filter((task) => task.blockId === block.id && taskInBlockOnDay(task, today))
         .sort((a, b) => (a.slotStart ?? '').localeCompare(b.slotStart ?? ''));

      if (seedSelection) {
         this._selected = new Set(blockTasks.filter((task) => !task.completed).map((task) => task.id));
      }

      this.renderTasks(blockTasks);
   }

   renderTasks(blockTasks) {
      this.$tasks.innerHTML = '';
      this.$empty.hidden = blockTasks.length > 0;
      const pending = blockTasks.filter((task) => !task.completed);
      const ordered = [...pending, ...blockTasks.filter((task) => task.completed)];

      for (const task of ordered) {
         const li = document.createElement('li');
         li.className = 'lc-focus-task';
         if (task.completed) {
            li.classList.add('lc-focus-task--done');
         }
         if (this._selected.has(task.id)) {
            li.classList.add('lc-focus-task--picked');
         }

         const pick = document.createElement('input');
         pick.type = 'checkbox';
         pick.className = 'lc-focus-task__pick';
         pick.checked = this._selected.has(task.id);
         pick.disabled = Boolean(task.completed);
         pick.setAttribute('aria-label', `Incluir ${task.title}`);
         pick.addEventListener('change', () => {
            if (pick.checked) {
               this._selected.add(task.id);
            } else {
               this._selected.delete(task.id);
            }
            li.classList.toggle('lc-focus-task--picked', pick.checked);
         });

         const done = document.createElement('input');
         done.type = 'checkbox';
         done.className = 'lc-focus-task__done';
         done.checked = Boolean(task.completed);
         done.setAttribute('aria-label', `Completar ${task.title}`);
         done.addEventListener('change', () => {
            this.taskService?.toggleComplete(task.id, done.checked);
         });

         const info = document.createElement('div');
         info.className = 'lc-focus-task__info';
         const title = document.createElement('span');
         title.className = 'lc-focus-task__title';
         title.textContent = task.title;
         const meta = document.createElement('span');
         meta.className = 'lc-focus-task__meta';
         const slot =
            task.slotStart && task.slotEnd ? `${formatTaskSlotLabel(task.slotStart, task.slotEnd)} · ` : '';
         meta.textContent = `${slot}${formatDuration(task.minutes ?? 0, { short: true })}`;
         info.append(title, meta);

         li.append(pick, done, info);
         this.$tasks.appendChild(li);
      }
   }
}

customElements.define('slice-focus-overlay', FocusOverlay);
