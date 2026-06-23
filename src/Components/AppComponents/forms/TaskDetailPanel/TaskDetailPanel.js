import { domainForTask } from '../../sections/domainLookup.js';
import { taskDateRange } from '../../sections/plannerDates.js';
import { formatTaskSlotLabel } from '../../../Utils/taskSlotTimes.js';

const URGENCY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' };

export default class TaskDetailPanel extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'task-detail-panel' },
      taskId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$title = this.querySelector('[data-role="title"]');
      this.$status = this.querySelector('[data-role="status"]');
      this.$domain = this.querySelector('[data-role="domain"]');
      this.$urgency = this.querySelector('[data-role="urgency"]');
      this.$minutes = this.querySelector('[data-role="minutes"]');
      this.$start = this.querySelector('[data-role="start"]');
      this.$due = this.querySelector('[data-role="due"]');
      this.$place = this.querySelector('[data-role="place"]');
      this.$slotRow = this.querySelector('[data-role="slot-row"]');
      this.$slot = this.querySelector('[data-role="slot"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');
      this.timeBlockService = slice.getComponent('time-block-service');

      this.$edit.addEventListener('click', () => this.openEdit());

      slice.context.watch(
         'lifeControl',
         this,
         () => this.paint(),
         (state) => ({
            tasks: state?.tasks ?? [],
            domains: state?.domains ?? [],
            timeBlocks: state?.timeBlocks ?? []
         })
      );

      this.paint();
   }

   task() {
      return this.taskService?.getById?.(this.taskId) ?? null;
   }

   blockLabel(blockId) {
      if (!blockId) {
         return 'Inbox';
      }
      const block = this.timeBlockService?.getById?.(blockId);
      return block?.label ? `Bloque: ${block.label}` : 'En bloque';
   }

   formatDate(iso) {
      return iso || '—';
   }

   openEdit() {
      const task = this.task();
      if (!task) {
         return;
      }
      slice.events.emit('ui:modal:open', {
         title: 'Editar tarea',
         form: 'TaskForm',
         taskId: task.id
      });
   }

   paint() {
      const task = this.task();
      if (!task) {
         this.$title.textContent = 'Tarea no encontrada';
         this.$status.textContent = '';
         this.$edit.hidden = true;
         return;
      }

      const domain = domainForTask(task.domainId, this.domainService);
      const { start, end } = taskDateRange(task);
      const completed = !!task.completed;

      this.$title.textContent = task.title;
      this.$status.textContent = completed ? 'Completada' : 'Pendiente';
      this.$status.className = `task-detail-panel__status task-detail-panel__status--${completed ? 'done' : 'pending'}`;

      this.$domain.innerHTML = '';
      const badge = document.createElement('span');
      badge.className = 'lc-domain-badge';
      badge.style.setProperty('--domain-color', domain.color);
      badge.textContent = domain.name;
      this.$domain.appendChild(badge);

      this.$urgency.textContent = URGENCY_LABELS[task.urgency] ?? 'Media';
      this.$minutes.textContent = `${task.minutes ?? 0} min`;
      this.$start.textContent = this.formatDate(start);
      this.$due.textContent = this.formatDate(end);
      this.$place.textContent = this.blockLabel(task.blockId);
      const slotLabel = formatTaskSlotLabel(task.slotStart, task.slotEnd);
      if (this.$slotRow && this.$slot) {
         this.$slotRow.hidden = !slotLabel;
         this.$slot.textContent = slotLabel || '—';
      }
      this.$edit.hidden = false;
   }
}

customElements.define('slice-task-detail-panel', TaskDetailPanel);
