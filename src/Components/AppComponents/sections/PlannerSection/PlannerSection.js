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
import { compareTasksBySlot, isBlockPast, blockRelationToNow } from '../../../Utils/taskSlotTimes.js';
import { getHidePastBlocks } from '../plannerPrefs.js';

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
      this.$moneyLine = this.querySelector('[data-role="money-line"]');
      this.$moneyPay = this.querySelector('[data-role="money-pay"]');
      this.$moneyReceive = this.querySelector('[data-role="money-receive"]');
      this.$moneyShopping = this.querySelector('[data-role="money-shopping"]');
      this.$blocks = this.querySelector('[data-role="blocks"]');
      this.$blocksEmpty = this.querySelector('[data-role="blocks-empty"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$inboxToggle = this.querySelector('[data-role="inbox-toggle"]');
      this.$inboxLabel = this.querySelector('[data-role="inbox-label"]');
      this.$inboxPanel = this.querySelector('[data-role="inbox-panel"]');
      this.$weekGrid = this.querySelector('[data-role="week-grid"]');
      this.$monthGrid = this.querySelector('[data-role="month-grid"]');
      this.$addBlock = this.querySelector('[data-role="add-block"]');
      this._viewMode = 'day';
      this._cursorDate = todayISO();
      this._inboxOpen = false;
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

      this.$moneyPay?.addEventListener('click', () => slice.router?.navigate?.('/finances'));
      this.$moneyReceive?.addEventListener('click', () => slice.router?.navigate?.('/finances'));
      this.$moneyShopping?.addEventListener('click', () => slice.router?.navigate?.('/shopping'));
      this.$inboxToggle?.addEventListener('click', () => {
         if (!this.inboxTasks().length) {
            return;
         }
         this._inboxOpen = !this._inboxOpen;
         this.syncInboxPanel();
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

      this._clockTimer = setInterval(() => {
         if (this._viewMode === 'day' && this._cursorDate === todayISO() && getHidePastBlocks()) {
            this.renderBlocks();
         }
      }, 60 * 1000);

      slice.events.subscribe('planner:prefs-changed', () => this.renderAll(), { component: this });
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

   openTaskDetail(taskId) {
      slice.events.emit('ui:modal:open', {
         title: 'Detalle de tarea',
         form: 'TaskDetailPanel',
         taskId
      });
   }

   openPendingTasks() {
      slice.events.emit('ui:modal:open', {
         title: 'Tareas pendientes',
         form: 'PendingTasksPanel'
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
         onDelete: () => this.deleteTask(task.id),
         onOpenDetail: () => this.openTaskDetail(task.id)
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
         button.classList.toggle('lc-segment__btn--active', button.dataset.view === this._viewMode);
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
      const payables = [];
      const receivables = [];
      const shoppingItems = [];

      const finances =
         typeof this.financeService?.getDueOnDate === 'function'
            ? this.financeService.getDueOnDate(this._cursorDate)
            : [];

      for (const finance of finances) {
         const entry = {
            name: finance.description,
            amount: finance.amount,
            kind: finance.type === FINANCE_TYPE.RECEIVE ? 'receive' : 'pay'
         };
         if (entry.kind === 'receive') {
            receivables.push(entry);
         } else {
            payables.push(entry);
         }
      }

      const shoppingDue =
         typeof this.shoppingService?.getDueOnDate === 'function'
            ? this.shoppingService.getDueOnDate(this._cursorDate)
            : [];
      for (const shopping of shoppingDue) {
         shoppingItems.push({
            name: shopping.name,
            amount: null,
            kind: 'shopping'
         });
      }

      this.$moneyPay.hidden = payables.length === 0;
      this.$moneyReceive.hidden = receivables.length === 0;
      this.$moneyShopping.hidden = shoppingItems.length === 0;
      this.$moneyPay.textContent = `${payables.length} pago${payables.length === 1 ? '' : 's'}`;
      this.$moneyReceive.textContent = `${receivables.length} cobro${receivables.length === 1 ? '' : 's'}`;
      this.$moneyShopping.textContent = `${shoppingItems.length} compra${shoppingItems.length === 1 ? '' : 's'}`;
      this.$moneyLine.hidden = payables.length + receivables.length + shoppingItems.length === 0;
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

      const allBlocks = this.timeBlockService.getAll();
      const hidePast = getHidePastBlocks() && this._cursorDate === todayISO();
      const visible = hidePast ? allBlocks.filter((block) => !isBlockPast(block)) : allBlocks;
      const viewingToday = this._cursorDate === todayISO();
      const blocks = [...visible].sort((a, b) => this.blockRank(a, viewingToday) - this.blockRank(b, viewingToday));
      const hasNow = viewingToday && blocks.some((block) => blockRelationToNow(block) === 'current');
      this.$blocks.classList.toggle('planner-section__blocks--live', hasNow);
      this.$blocksEmpty.hidden = blocks.length > 0;
      if (this.$blocksEmpty && hidePast && allBlocks.length > 0 && blocks.length === 0) {
         this.$blocksEmpty.textContent = 'Los bloques de hoy ya pasaron. Puedes mostrarlos en Perfil.';
         this.$blocksEmpty.hidden = false;
      } else if (this.$blocksEmpty) {
         this.$blocksEmpty.textContent = 'Sin bloques. Configura uno arriba.';
      }

      for (const block of blocks) {
         const usedMinutes = this.timeBlockService.usedMinutes(block.id, this._cursorDate);
         const blockTasks = this.taskService
            .getAll()
            .filter((t) => t.blockId === block.id && taskInBlockOnDay(t, this._cursorDate))
            .sort(compareTasksBySlot);
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
         if (viewingToday && blockRelationToNow(block) === 'current') {
            blockEl.classList.add('time-block--now');
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

         this.$inboxLabel.textContent = tasks.length === 1 ? '1 sin bloque' : `${tasks.length} sin bloque`;
         this.$inboxToggle.hidden = tasks.length === 0 && domains.length > 0;

         if (domains.length === 0) {
            this.$inboxToggle.hidden = false;
            this.$inboxLabel.textContent = 'Crea un dominio en Perfil';
            this.$inboxOpen = false;
            this.$empty.textContent = 'Crea un dominio en Dominios primero.';
            this.$empty.hidden = false;
            this.syncInboxPanel();
            return;
         }

         if (tasks.length === 0) {
            this._inboxOpen = false;
            this.$empty.hidden = true;
            this.syncInboxPanel();
            return;
         }

         this.$empty.hidden = true;
         this.syncInboxPanel();

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

   syncInboxPanel() {
      const open = this._inboxOpen && !this.$inboxToggle.hidden;
      this.$inboxPanel.hidden = !open;
      this.$inboxToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
   }

   blockRank(block, viewingToday) {
      if (!viewingToday) {
         return 1;
      }
      const relation = blockRelationToNow(block);
      if (relation === 'current') {
         return 0;
      }
      if (relation === 'future') {
         return 1;
      }
      return 2;
   }

   renderWeekView() {
      this.$weekGrid.innerHTML = '';
      const days = getWeekDays(this._cursorDate);
      const tasks = this.taskService?.getAll?.() ?? [];

      for (const iso of days) {
         const dayTasks = tasks.filter((task) => taskShowsOnCalendarDay(task, iso));
         const financeDue =
            typeof this.financeService?.getDueOnDate === 'function'
               ? this.financeService.getDueOnDate(iso).length
               : 0;
         const shoppingDue =
            typeof this.shoppingService?.getDueOnDate === 'function'
               ? this.shoppingService.getDueOnDate(iso).length
               : 0;
         const paymentCount = financeDue + shoppingDue;

         const column = document.createElement('button');
         column.type = 'button';
         column.className = 'planner-week__day planner-week__day--jump';
         if (isSameDay(iso, todayISO())) {
            column.classList.add('planner-week__day--today');
         }
         if (isSameDay(iso, this._cursorDate)) {
            column.classList.add('planner-week__day--selected');
         }

         const header = document.createElement('span');
         header.className = 'planner-week__day-head';
         header.textContent = formatShortDay(iso);

         const meta = document.createElement('span');
         meta.className = 'planner-week__meta';
         const bits = [];
         if (dayTasks.length) {
            bits.push(`${dayTasks.length} tarea${dayTasks.length === 1 ? '' : 's'}`);
         }
         if (paymentCount) {
            bits.push(`${paymentCount} pago${paymentCount === 1 ? '' : 's'}`);
         }
         meta.textContent = bits.join(' · ') || 'Libre';

         column.append(header, meta);
         column.addEventListener('click', () => this.goToDay(iso));
         this.$weekGrid.appendChild(column);
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

            const dayTasks = tasks.filter((task) => taskShowsOnCalendarDay(task, cell.iso));
            const financeDue =
               typeof this.financeService?.getDueOnDate === 'function'
                  ? this.financeService.getDueOnDate(cell.iso).length
                  : 0;
            const shoppingDue =
               typeof this.shoppingService?.getDueOnDate === 'function'
                  ? this.shoppingService.getDueOnDate(cell.iso).length
                  : 0;

            const meta = document.createElement('span');
            meta.className = 'planner-month__count';
            const bits = [];
            if (dayTasks.length) {
               bits.push(String(dayTasks.length));
            }
            if (financeDue + shoppingDue > 0) {
               bits.push(`${financeDue + shoppingDue} pago${financeDue + shoppingDue === 1 ? '' : 's'}`);
            }
            meta.textContent = bits.join(' · ');

            dayEl.append(dayNumber, meta);
            dayEl.addEventListener('click', () => this.goToDay(cell.iso));
            this.$monthGrid.appendChild(dayEl);
         }
      }
   }

   _taskCardPrefix() {
      return `task-card-${this.sliceId}-`;
   }
}

function parseISO(iso) {
   return new Date(`${iso}T12:00:00`);
}

customElements.define('slice-planner-section', PlannerSection);
