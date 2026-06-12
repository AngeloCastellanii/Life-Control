import { FINANCE_TYPE } from '../lifeControlConstants.js';
import { domainForTask } from '../domainLookup.js';
import {
   addDays,
   addMonths,
   dueBadgeLabel,
   formatDayLong,
   formatMonthLabel,
   formatShortDay,
   formatWeekLabel,
   getMonthMatrix,
   getWeekDays,
   isSameDay,
   taskInBlockOnDay,
   taskInInboxOnDay,
   taskShowsOnCalendarDay,
   todayISO
} from '../plannerDates.js';

export default class PlannerSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'planner-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$periodLabel = this.querySelector('[data-role="period-label"]');
      this.$prev = this.querySelector('[data-role="prev"]');
      this.$next = this.querySelector('[data-role="next"]');
      this.$today = this.querySelector('[data-role="today"]');
      this.$viewToggle = this.querySelector('[data-role="view-toggle"]');
      this.$viewDay = this.querySelector('[data-role="view-day"]');
      this.$viewWeek = this.querySelector('[data-role="view-week"]');
      this.$viewMonth = this.querySelector('[data-role="view-month"]');
      this.$cashFlow = this.querySelector('[data-role="cash-flow"]');
      this.$cashFlowEmpty = this.querySelector('[data-role="cash-flow-empty"]');
      this.$blocks = this.querySelector('[data-role="blocks"]');
      this.$blocksEmpty = this.querySelector('[data-role="blocks-empty"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$inboxCount = this.querySelector('[data-role="inbox-count"]');
      this.$weekGrid = this.querySelector('[data-role="week-grid"]');
      this.$monthGrid = this.querySelector('[data-role="month-grid"]');
      this.$addBlock = this.querySelector('[data-role="add-block"]');
      this._viewMode = 'day';
      this._cursorDate = todayISO();
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$addBlock.addEventListener('click', () => {
         slice.events.emit('ui:modal:open', {
            title: 'Configurar Contenedor de Tiempo',
            form: 'BlockForm'
         });
      });

      this.$prev.addEventListener('click', () => this.shiftCursor(-1));
      this.$next.addEventListener('click', () => this.shiftCursor(1));
      this.$today.addEventListener('click', () => {
         this._cursorDate = todayISO();
         this.renderAll();
      });

      this.$viewToggle.addEventListener('click', (event) => {
         const button = event.target.closest('[data-view]');
         if (!button) {
            return;
         }
         this.setViewMode(button.dataset.view);
      });

      this._bindServices();
      if (!this._servicesReady()) {
         return;
      }

      this._plannerWatchPrev = null;
      slice.context.watch(
         'lifeControl',
         this,
         (selected) => {
            const prev = this._plannerWatchPrev;
            this._plannerWatchPrev = selected;

            if (prev) {
               const layoutUnchanged =
                  prev.tasks === selected.tasks &&
                  prev.domains === selected.domains &&
                  prev.timeBlocks === selected.timeBlocks;
               const cashChanged =
                  prev.finances !== selected.finances || prev.shopping !== selected.shopping;

               if (layoutUnchanged && cashChanged && this._viewMode === 'day') {
                  this.renderCashFlow();
                  return;
               }
            }

            this.renderAll();
         },
         (state) => ({
            tasks: state?.tasks ?? [],
            domains: state?.domains ?? [],
            timeBlocks: state?.timeBlocks ?? [],
            finances: state?.finances ?? [],
            shopping: state?.shopping ?? []
         })
      );

      this.renderAll();
   }

   _bindServices() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');
      this.timeBlockService = slice.getComponent('time-block-service');
      this.financeService = slice.getComponent('finance-service');
      this.shoppingService = slice.getComponent('shopping-service');
   }

   _servicesReady() {
      return Boolean(this.taskService && this.domainService && this.timeBlockService);
   }

   async update() {
      this._bindServices();
      if (!this._servicesReady()) {
         return;
      }
      await this.renderAll();
   }

   setViewMode(mode) {
      if (!['day', 'week', 'month'].includes(mode)) {
         return;
      }
      this._viewMode = mode;
      this.renderAll();
   }

   shiftCursor(direction) {
      if (this._viewMode === 'day') {
         this._cursorDate = addDays(this._cursorDate, direction);
      } else if (this._viewMode === 'week') {
         this._cursorDate = addDays(this._cursorDate, direction * 7);
      } else {
         this._cursorDate = addMonths(this._cursorDate, direction);
      }
      this.renderAll();
   }

   goToDay(iso) {
      this._cursorDate = iso;
      this._viewMode = 'day';
      this.renderAll();
   }

   openTaskEdit(taskId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar tarea',
         form: 'TaskForm',
         taskId
      });
   }

   async deleteTask(taskId) {
      if (window.confirm('¿Eliminar esta tarea?')) {
         await this.taskService.remove(taskId);
      }
   }

   taskCardActions(task) {
      return {
         onToggleComplete: (completed) => this.taskService.toggleComplete(task.id, completed),
         onEdit: () => this.openTaskEdit(task.id),
         onDelete: () => this.deleteTask(task.id)
      };
   }

   domainForTask(domainId) {
      return domainForTask(domainId, this.domainService);
   }

   _destroyByPrefix(prefix) {
      const ids = [...slice.controller.activeComponents.keys()].filter((id) => id.startsWith(prefix));
      if (ids.length) {
         slice.controller.destroyComponent(ids);
      }
   }

   tasksForDay(iso) {
      return (this.taskService?.getAll?.() ?? []).filter((task) => taskShowsOnCalendarDay(task, iso));
   }

   inboxTasks() {
      return (this.taskService?.getAll?.() ?? []).filter((task) =>
         taskInInboxOnDay(task, this._cursorDate)
      );
   }

   updateToolbar() {
      if (this._viewMode === 'day') {
         this.$periodLabel.textContent = formatDayLong(this._cursorDate);
      } else if (this._viewMode === 'week') {
         this.$periodLabel.textContent = formatWeekLabel(this._cursorDate);
      } else {
         this.$periodLabel.textContent = formatMonthLabel(this._cursorDate);
      }

      for (const button of this.$viewToggle.querySelectorAll('[data-view]')) {
         button.classList.toggle('planner-section__view-btn--active', button.dataset.view === this._viewMode);
      }

      this.$viewDay.hidden = this._viewMode !== 'day';
      this.$viewWeek.hidden = this._viewMode !== 'week';
      this.$viewMonth.hidden = this._viewMode !== 'month';
   }

   async renderAll() {
      if (!this._servicesReady()) {
         return;
      }

      if (this._renderingAll) {
         this._renderPending = true;
         return;
      }

      this._renderingAll = true;
      try {
         do {
            this._renderPending = false;
            this.updateToolbar();

            if (this._viewMode === 'day') {
               await this.renderDayView();
            } else if (this._viewMode === 'week') {
               this.renderWeekView();
            } else {
               this.renderMonthView();
            }
         } while (this._renderPending);
      } finally {
         this._renderingAll = false;
      }
   }

   async renderDayView() {
      this.renderCashFlow();
      await this.renderBlocks();
      await this.renderInbox();
   }

   renderCashFlow() {
      this.$cashFlow.innerHTML = '';
      const items = [];
      const finances = this.financeService?.getAll() ?? [];

      for (const finance of finances) {
         if (finance.settled) {
            continue;
         }
         if (finance.dueDate && finance.dueDate !== this._cursorDate) {
            continue;
         }
         items.push({
            name: finance.description,
            amount: finance.amount,
            kind: finance.type === FINANCE_TYPE.RECEIVE ? 'income' : 'debt'
         });
      }

      const shoppingDue =
         typeof this.shoppingService?.getDueOnDate === 'function'
            ? this.shoppingService.getDueOnDate(this._cursorDate)
            : [];
      for (const shopping of shoppingDue) {
         items.push({
            name: shopping.name,
            amount: null,
            kind: 'debt'
         });
      }

      this.$cashFlowEmpty.hidden = items.length > 0;

      for (const item of items) {
         const card = document.createElement('article');
         card.className = `planner-section__cash-item planner-section__cash-item--${item.kind}`;

         const label = document.createElement('span');
         label.className = 'planner-section__cash-label';
         label.textContent = item.kind === 'income' ? 'INGRESO' : 'DEUDA';

         const name = document.createElement('strong');
         name.textContent = item.name;

         const amount = document.createElement('span');
         amount.className = 'planner-section__cash-amount';
         amount.textContent = item.amount != null ? `$${Number(item.amount).toFixed(2)}` : '—';

         card.append(label, name, amount);
         this.$cashFlow.appendChild(card);
      }
   }

   async renderBlocks() {
      if (this._renderingBlocks) {
         return;
      }
      this._renderingBlocks = true;
      try {
         await this._renderBlocksContent();
      } finally {
         this._renderingBlocks = false;
      }
   }

   async _renderBlocksContent() {
      if (typeof this.timeBlockService?.getAll !== 'function') {
         this.timeBlockService = slice.getComponent('time-block-service');
      }
      if (typeof this.timeBlockService?.getAll !== 'function') {
         this.$blocksEmpty.hidden = false;
         return;
      }

      this._destroyByPrefix('planner-block-');
      this._destroyByPrefix('task-card-block-');
      this.$blocks.innerHTML = '';

      const blocks = this.timeBlockService.getAll();
      this.$blocksEmpty.hidden = blocks.length > 0;

      for (const block of blocks) {
         const usedMinutes = this.timeBlockService.usedMinutes(block.id);
         const blockTasks = this.taskService
            .getAll()
            .filter((t) => t.blockId === block.id && taskInBlockOnDay(t, this._cursorDate));
         const blockEl = await slice.build('TimeBlock', {
            sliceId: `planner-block-${block.id}`,
            block,
            usedMinutes,
            taskCount: blockTasks.length,
            onRemove: (id) => this.timeBlockService.remove(id),
            onEdit: (id) => {
               slice.events.emit('ui:modal:open', {
                  title: 'Configurar Contenedor de Tiempo',
                  form: 'BlockForm',
                  blockId: id
               });
            }
         });

         if (!blockEl) {
            continue;
         }

         const tasksHost = blockEl.querySelector('[data-role="tasks"]');

         for (const task of blockTasks) {
            const domain = this.domainForTask(task.domainId);
            const card = await slice.build('TaskCard', {
               sliceId: `task-card-block-${block.id}-${task.id}`,
               task,
               domainColor: domain.color,
               domainName: domain.name,
               ...this.taskCardActions(task),
               onRemoveFromBlock: () => this.timeBlockService.unassignTask(block.id, task.id)
            });
            if (card) {
               tasksHost.appendChild(card);
            }
         }

         this.$blocks.appendChild(blockEl);
      }
   }

   async renderInbox() {
      if (this._renderingInbox) {
         return;
      }
      this._renderingInbox = true;
      try {
         this._destroyByPrefix(this._taskCardPrefix());
         this.$tasks.innerHTML = '';

         const tasks = this.inboxTasks();
         const domains = this.domainService.getAll();
         const blockOptions = this.timeBlockService
            .getAll()
            .filter((b) => this.timeBlockService.acceptsTasks(b))
            .map((b) => ({ id: b.id, label: b.label }));

         this.$inboxCount.textContent = tasks.length ? String(tasks.length) : '';

         if (domains.length === 0) {
            this.$empty.textContent = 'Crea un dominio en Dominios primero.';
            this.$empty.hidden = false;
            return;
         }

         if (tasks.length === 0) {
            this.$empty.textContent = 'Sin tareas en el inbox. Pulsa +.';
            this.$empty.hidden = false;
            return;
         }

         this.$empty.hidden = true;

         for (const task of tasks) {
            const domain = this.domainForTask(task.domainId);
            const card = await slice.build('TaskCard', {
               sliceId: `${this._taskCardPrefix()}${task.id}`,
               task,
               domainColor: domain.color,
               domainName: domain.name,
               assignBlocks: blockOptions,
               ...this.taskCardActions(task),
               onAssignToBlock: async (taskId, blockId) => {
                  const current = this.taskService.getById(taskId);
                  if (current && !current.startDate && !current.dueDate && !current.scheduledDate) {
                     await this.taskService.update(taskId, { startDate: this._cursorDate });
                  }
                  await this.timeBlockService.assignTask(blockId, taskId);
               }
            });
            if (card) {
               this.$tasks.appendChild(card);
            }
         }
      } finally {
         this._renderingInbox = false;
      }
   }

   renderWeekView() {
      this.$weekGrid.innerHTML = '';
      const days = getWeekDays(this._cursorDate);
      const tasks = this.taskService?.getAll?.() ?? [];

      for (const iso of days) {
         const column = document.createElement('article');
         column.className = 'planner-week__day';
         if (isSameDay(iso, todayISO())) {
            column.classList.add('planner-week__day--today');
         }
         if (isSameDay(iso, this._cursorDate) && !isSameDay(iso, todayISO())) {
            column.classList.add('planner-week__day--selected');
         }

         const header = document.createElement('button');
         header.type = 'button';
         header.className = 'planner-week__day-head';
         header.textContent = formatShortDay(iso);
         header.addEventListener('click', () => this.goToDay(iso));

         const tasksSection = document.createElement('div');
         tasksSection.className = 'planner-week__section';
         const tasksTitle = document.createElement('span');
         tasksTitle.className = 'planner-week__section-title';
         tasksTitle.textContent = 'Tareas';
         tasksSection.appendChild(tasksTitle);

         const dayTasks = tasks.filter((task) => taskShowsOnCalendarDay(task, iso));
         if (dayTasks.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'planner-week__empty';
            empty.textContent = 'Día libre';
            tasksSection.appendChild(empty);
         } else {
            for (const task of dayTasks) {
               tasksSection.appendChild(this.weekTaskChip(task));
            }
         }

         const paymentsSection = document.createElement('div');
         paymentsSection.className = 'planner-week__section';
         const paymentsTitle = document.createElement('span');
         paymentsTitle.className = 'planner-week__section-title';
         paymentsTitle.textContent = 'Pagos';
         paymentsSection.appendChild(paymentsTitle);
         this.fillWeekPayments(paymentsSection, iso);

         column.append(header, tasksSection, paymentsSection);
         this.$weekGrid.appendChild(column);
      }
   }

   weekTaskChip(task) {
      const domain = this.domainForTask(task.domainId);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'planner-week__task';
      chip.title = `${domain.name} · ${task.title}`;

      const badge = document.createElement('span');
      badge.className = 'lc-domain-badge planner-week__task-domain';
      badge.style.setProperty('--domain-color', domain.color);
      badge.textContent = domain.name;

      const title = document.createElement('span');
      title.className = 'planner-week__task-title';
      title.textContent = task.title;

      chip.append(badge, title);
      chip.addEventListener('click', () => this.openTaskEdit(task.id));
      return chip;
   }

   fillWeekPayments(section, iso) {
      const finances =
         typeof this.financeService?.getDueOnDate === 'function'
            ? this.financeService.getDueOnDate(iso)
            : [];
      const shopping =
         typeof this.shoppingService?.getDueOnDate === 'function'
            ? this.shoppingService.getDueOnDate(iso)
            : [];
      const payments = [
         ...finances.map((item) => ({
            name: item.description,
            kind: item.type === FINANCE_TYPE.RECEIVE ? 'income' : 'debt'
         })),
         ...shopping.map((item) => ({ name: item.name, kind: 'debt' }))
      ];

      if (payments.length === 0) {
         const empty = document.createElement('p');
         empty.className = 'planner-week__empty';
         empty.textContent = '—';
         section.appendChild(empty);
         return;
      }

      for (const payment of payments) {
         const row = document.createElement('span');
         row.className = `planner-week__payment planner-week__payment--${payment.kind}`;
         row.textContent = payment.name;
         section.appendChild(row);
      }
   }

   renderMonthView() {
      this.$monthGrid.innerHTML = '';
      const tasks = this.taskService?.getAll?.() ?? [];
      const weeks = getMonthMatrix(this._cursorDate);

      for (const week of weeks) {
         for (const cell of week) {
            const dayEl = document.createElement('button');
            dayEl.type = 'button';
            dayEl.className = 'planner-month__cell';
            if (!cell.inMonth) {
               dayEl.classList.add('planner-month__cell--muted');
            }
            if (isSameDay(cell.iso, todayISO())) {
               dayEl.classList.add('planner-month__cell--today');
            }

            const dayNumber = document.createElement('span');
            dayNumber.className = 'planner-month__day-num';
            dayNumber.textContent = String(parseISO(cell.iso).getDate());

            const list = document.createElement('div');
            list.className = 'planner-month__list';

            const dayTasks = tasks.filter((task) => taskShowsOnCalendarDay(task, cell.iso));
            for (const task of dayTasks.slice(0, 3)) {
               list.appendChild(this.monthTaskLine(task));
            }
            if (dayTasks.length > 3) {
               const more = document.createElement('span');
               more.className = 'planner-month__more';
               more.textContent = `+${dayTasks.length - 3} más`;
               list.appendChild(more);
            }

            const financeDue =
               typeof this.financeService?.getDueOnDate === 'function'
                  ? this.financeService.getDueOnDate(cell.iso).length
                  : 0;
            const shoppingDue =
               typeof this.shoppingService?.getDueOnDate === 'function'
                  ? this.shoppingService.getDueOnDate(cell.iso).length
                  : 0;
            const paymentCount = financeDue + shoppingDue;
            if (paymentCount > 0) {
               const badge = document.createElement('span');
               badge.className = 'planner-month__payment-dot';
               badge.textContent = `${paymentCount} pago${paymentCount > 1 ? 's' : ''}`;
               list.appendChild(badge);
            }

            dayEl.append(dayNumber, list);
            dayEl.addEventListener('click', () => this.goToDay(cell.iso));
            this.$monthGrid.appendChild(dayEl);
         }
      }
   }

   monthTaskLine(task) {
      const domain = this.domainForTask(task.domainId);
      const line = document.createElement('span');
      line.className = 'planner-month__task';
      line.title = `${domain.name} · ${task.title}`;
      line.style.setProperty('--domain-color', domain.color);
      line.textContent = task.title;
      return line;
   }

   _taskCardPrefix() {
      return `task-card-${this.sliceId}-`;
   }
}

function parseISO(iso) {
   return new Date(`${iso}T12:00:00`);
}

customElements.define('slice-planner-section', PlannerSection);
