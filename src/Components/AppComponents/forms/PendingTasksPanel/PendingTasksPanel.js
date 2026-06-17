import { domainForTask } from '../../sections/domainLookup.js';
import { taskDateRange } from '../../sections/plannerDates.js';

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };
const URGENCY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' };

export default class PendingTasksPanel extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$urgency = this.querySelector('[data-role="urgency"]');
      this.$domain = this.querySelector('[data-role="domain"]');
      this.$count = this.querySelector('[data-role="count"]');
      this.$list = this.querySelector('[data-role="list"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');
      this.timeBlockService = slice.getComponent('time-block-service');

      this.$urgency.addEventListener('change', () => this.renderList());
      this.$domain.addEventListener('change', () => this.renderList());

      slice.context.watch(
         'lifeControl',
         this,
         () => {
            this.fillDomains();
            this.renderList();
         },
         (state) => ({
            tasks: state?.tasks ?? [],
            domains: state?.domains ?? []
         })
      );

      this.fillDomains();
      this.renderList();
   }

   fillDomains() {
      const domains = this.domainService?.getAll?.() ?? [];
      const current = this.$domain.value || 'all';
      this.$domain.innerHTML = '<option value="all">Todos</option>';

      for (const domain of domains) {
         const option = document.createElement('option');
         option.value = domain.id;
         option.textContent = domain.name;
         this.$domain.appendChild(option);
      }

      if ([...this.$domain.options].some((opt) => opt.value === current)) {
         this.$domain.value = current;
      }
   }

   pendingTasks() {
      return (this.taskService?.getAll?.() ?? []).filter((task) => !task.completed);
   }

   filteredTasks() {
      const urgency = this.$urgency.value;
      const domainId = this.$domain.value;

      return this.pendingTasks()
         .filter((task) => urgency === 'all' || task.urgency === urgency)
         .filter((task) => domainId === 'all' || task.domainId === domainId)
         .sort((a, b) => {
            const diff = (URGENCY_ORDER[a.urgency] ?? 1) - (URGENCY_ORDER[b.urgency] ?? 1);
            if (diff !== 0) {
               return diff;
            }
            return a.title.localeCompare(b.title);
         });
   }

   blockLabel(blockId) {
      if (!blockId) {
         return 'Inbox';
      }
      const block = this.timeBlockService?.getById?.(blockId);
      return block?.label ? `Bloque: ${block.label}` : 'En bloque';
   }

   formatDateRange(task) {
      const { start, end } = taskDateRange(task);
      if (!start && !end) {
         return 'Sin fecha';
      }
      if (start && end && start !== end) {
         return `${start} → ${end}`;
      }
      return end ?? start;
   }

   openEdit(taskId) {
      slice.events.emit('ui:modal:open', {
         title: 'Detalle de tarea',
         form: 'TaskDetailPanel',
         taskId
      });
   }

   renderList() {
      const tasks = this.filteredTasks();
      this.$list.innerHTML = '';
      this.$count.textContent =
         tasks.length === 0
            ? '0 tareas pendientes'
            : `${tasks.length} tarea${tasks.length === 1 ? '' : 's'} pendiente${tasks.length === 1 ? '' : 's'}`;
      this.$empty.hidden = tasks.length > 0;

      for (const task of tasks) {
         const domain = domainForTask(task.domainId, this.domainService);
         const item = document.createElement('li');
         item.className = 'pending-tasks-panel__item';

         const btn = document.createElement('button');
         btn.type = 'button';
         btn.className = 'pending-tasks-panel__row';

         const head = document.createElement('div');
         head.className = 'pending-tasks-panel__row-head';

         const title = document.createElement('span');
         title.className = 'pending-tasks-panel__title';
         title.textContent = task.title;

         const urgency = document.createElement('span');
         urgency.className = `pending-tasks-panel__urgency pending-tasks-panel__urgency--${task.urgency || 'medium'}`;
         urgency.textContent = URGENCY_LABELS[task.urgency] ?? 'Media';

         head.append(title, urgency);

         const meta = document.createElement('div');
         meta.className = 'pending-tasks-panel__meta';

         const badge = document.createElement('span');
         badge.className = 'lc-domain-badge';
         badge.style.setProperty('--domain-color', domain.color);
         badge.textContent = domain.name;

         const place = document.createElement('span');
         place.className = 'pending-tasks-panel__place';
         place.textContent = this.blockLabel(task.blockId);

         const dates = document.createElement('span');
         dates.className = 'pending-tasks-panel__dates';
         dates.textContent = this.formatDateRange(task);

         meta.append(badge, place, dates);
         btn.append(head, meta);
         btn.addEventListener('click', () => this.openEdit(task.id));
         item.appendChild(btn);
         this.$list.appendChild(item);
      }
   }
}

customElements.define('slice-pending-tasks-panel', PendingTasksPanel);
