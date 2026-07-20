import { taskInBlockOnDay, todayISO } from '../plannerDates.js';
import { formatDuration } from '../../../Utils/formatDuration.js';

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

export default class FocusSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'focus-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$clock = this.querySelector('[data-role="clock"]');
      this.$tag = this.querySelector('[data-role="block-tag"]');
      this.$label = this.querySelector('[data-role="block-label"]');
      this.$range = this.querySelector('[data-role="block-range"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.render();
      this._timer = setInterval(() => this.render(), 60 * 1000);

      slice.context.watch(
         'lifeControl',
         this,
         () => this.render(),
         (state) => ({ tasks: state?.tasks ?? [], timeBlocks: state?.timeBlocks ?? [] })
      );
   }

   disconnectedCallback() {
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
      this.$clock.textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      let block = currentBlock(blocks, nowMinutes);
      let isNow = Boolean(block);
      if (!block) {
         block = nextBlock(blocks, nowMinutes);
      }

      if (!block) {
         this.$tag.textContent = 'Ahora';
         this.$label.textContent = 'Sin bloques configurados';
         this.$range.textContent = '';
         this.$tasks.innerHTML = '';
         this.$empty.hidden = false;
         return;
      }

      this.$tag.textContent = isNow ? 'Ahora' : 'Próximo bloque';
      this.$label.textContent = block.label;
      this.$range.textContent = `${block.start} — ${block.end}`;

      const today = todayISO();
      const blockTasks = tasks
         .filter((t) => t.blockId === block.id && taskInBlockOnDay(t, today))
         .sort((a, b) => (a.slotStart ?? '').localeCompare(b.slotStart ?? ''));

      this.renderTasks(blockTasks);
   }

   renderTasks(blockTasks) {
      this.$tasks.innerHTML = '';
      const pending = blockTasks.filter((t) => !t.completed);
      this.$empty.hidden = blockTasks.length > 0;

      const ordered = [...pending, ...blockTasks.filter((t) => t.completed)];

      for (const task of ordered) {
         const li = document.createElement('li');
         li.className = 'focus-section__task';
         if (task.completed) {
            li.classList.add('focus-section__task--done');
         }

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.className = 'focus-section__check';
         checkbox.checked = Boolean(task.completed);
         checkbox.addEventListener('change', () => {
            this.taskService?.toggleComplete(task.id, checkbox.checked);
         });

         const info = document.createElement('div');
         info.className = 'focus-section__task-info';

         const title = document.createElement('span');
         title.className = 'focus-section__task-title';
         title.textContent = task.title;
         info.appendChild(title);

         const meta = document.createElement('span');
         meta.className = 'focus-section__task-meta';
         const slot = task.slotStart && task.slotEnd ? `${task.slotStart}–${task.slotEnd} · ` : '';
         meta.textContent = `${slot}${formatDuration(task.minutes ?? 0, { short: true })}`;
         info.appendChild(meta);

         li.append(checkbox, info);
         this.$tasks.appendChild(li);
      }
   }
}

customElements.define('slice-focus-section', FocusSection);
