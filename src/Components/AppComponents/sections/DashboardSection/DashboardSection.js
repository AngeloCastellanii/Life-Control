import { formatDayLong, taskShowsOnCalendarDay, todayISO, taskDateRange } from '../plannerDates.js';
import { domainForTask } from '../domainLookup.js';
import { greetingForName } from '../profileGreeting.js';
import {
   DASHBOARD_TASK_FILTERS,
   getDashboardTaskFilter,
   setDashboardTaskFilter
} from '../plannerPrefs.js';

export default class DashboardSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'dashboard-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$greetingTitle = this.querySelector('[data-role="greeting-title"]');
      this.$dateSubtitle = this.querySelector('[data-role="date-subtitle"]');
      this.$capacityMount = this.querySelector('[data-role="capacity-ring"]');
      this.$capacityText = this.querySelector('[data-role="capacity-text"]');
      this.$tasksCount = this.querySelector('[data-role="tasks-count"]');
      this.$blocksCount = this.querySelector('[data-role="blocks-count"]');
      this.$rate = this.querySelector('[data-role="rate"]');
      this.$rateCard = this.querySelector('[data-role="rate-card"]');
      this.$rateRetry = this.querySelector('[data-role="rate-retry"]');
      this.$taskList = this.querySelector('[data-role="task-list"]');
      this.$taskEmpty = this.querySelector('[data-role="task-empty"]');
      this.$taskFilters = this.querySelectorAll('[data-filter]');
      this.$todayList = this.querySelector('[data-role="today-list"]');
      this.$todayEmpty = this.querySelector('[data-role="today-empty"]');
      this._taskFilter = getDashboardTaskFilter();
      this._capacityRing = null;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.timeBlockService = slice.getComponent('time-block-service');
      this.exchangeRateService = slice.getComponent('exchange-rate-service');
      this.financeService = slice.getComponent('finance-service');
      this.shoppingService = slice.getComponent('shopping-service');
      this.domainService = slice.getComponent('domain-service');

      this._capacityRing = await slice.build('CapacityRing', {
         sliceId: 'dashboard-capacity-ring',
         percent: 0
      });
      this.$capacityMount.appendChild(this._capacityRing);

      this.$rateRetry.addEventListener('click', (event) => {
         event.stopPropagation();
         this.exchangeRateService?.fetchRate();
      });

      for (const button of this.$taskFilters) {
         button.addEventListener('click', () => this.setTaskFilter(button.dataset.filter));
      }
      this.syncFilterButtons();

      this.$rateCard?.addEventListener('click', () => this.openExchangeCalculator());
      this.$rateCard?.addEventListener('keydown', (event) => {
         if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.openExchangeCalculator();
         }
      });

      slice.context.watch(
         'lifeControl',
         this,
         (data) => this.refresh(data),
         (state) => ({
            tasks: state?.tasks ?? [],
            timeBlocks: state?.timeBlocks ?? [],
            domains: state?.domains ?? [],
            profile: state?.profile ?? { displayName: '' },
            exchangeRate: state?.exchangeRate ?? {},
            finances: state?.finances ?? [],
            shopping: state?.shopping ?? [],
            notes: state?.notes ?? []
         })
      );

      const state = slice.context.getState('lifeControl') ?? {};
      this.refresh({
         tasks: this.taskService?.getAll() ?? [],
         timeBlocks: this.timeBlockService?.getAll() ?? [],
         domains: this.domainService?.getAll() ?? [],
         profile: state.profile ?? { displayName: '' },
         exchangeRate: state.exchangeRate ?? {},
         finances: this.financeService?.getAll() ?? [],
         shopping: this.shoppingService?.getAll() ?? []
      });
   }

   async update() {
      this.taskService = slice.getComponent('task-service');
      this.timeBlockService = slice.getComponent('time-block-service');
      this.exchangeRateService = slice.getComponent('exchange-rate-service');
      this.financeService = slice.getComponent('finance-service');
      this.shoppingService = slice.getComponent('shopping-service');
      this.domainService = slice.getComponent('domain-service');

      const state = slice.context.getState('lifeControl') ?? {};
      this.refresh({
         tasks: state.tasks ?? this.taskService?.getAll?.() ?? [],
         timeBlocks: state.timeBlocks ?? this.timeBlockService?.getAll?.() ?? [],
         domains: state.domains ?? this.domainService?.getAll?.() ?? [],
         profile: state.profile ?? { displayName: '' },
         exchangeRate: state.exchangeRate ?? {},
         finances: state.finances ?? this.financeService?.getAll?.() ?? [],
         shopping: state.shopping ?? this.shoppingService?.getAll?.() ?? []
      });
   }

   formatMoney(value) {
      return `$${(Number(value) || 0).toFixed(2)}`;
   }

   openExchangeCalculator() {
      const exchangeRate = slice.context.getState('lifeControl')?.exchangeRate ?? {};
      if (!exchangeRate.rate) {
         return;
      }
      slice.events.emit('ui:modal:open', {
         title: 'Calculadora de cambio',
         form: 'ExchangeCalculatorPanel'
      });
   }

   refresh({ tasks, timeBlocks, domains, profile, exchangeRate, finances }) {
      const today = todayISO();
      this.$greetingTitle.textContent = greetingForName(profile?.displayName ?? '');
      this.$dateSubtitle.textContent = formatDayLong(today);

      const pending = tasks.filter((task) => !task.completed);
      const todayTasks = tasks.filter((task) => taskShowsOnCalendarDay(task, today));
      const completedToday = todayTasks.filter((task) => task.completed).length;
      const totalToday = todayTasks.length;
      const percent = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;

      if (this._capacityRing) {
         this._capacityRing.percent = percent;
      }
      this.$capacityText.textContent = `${completedToday} / ${totalToday} hoy`;
      this.$tasksCount.textContent = String(pending.length);
      this.$blocksCount.textContent = String(timeBlocks.length);

      this.renderRate(exchangeRate);
      this.renderDueToday(tasks, finances);
      this.renderTaskView(pending, domains ?? this.domainService?.getAll?.() ?? [], tasks);
   }

   setTaskFilter(filter) {
      this._taskFilter = setDashboardTaskFilter(filter);
      this.syncFilterButtons();
      const state = slice.context.getState('lifeControl') ?? {};
      const tasks = state.tasks ?? this.taskService?.getAll?.() ?? [];
      const pending = tasks.filter((task) => !task.completed);
      this.renderTaskView(pending, state.domains ?? this.domainService?.getAll?.() ?? [], tasks);
   }

   syncFilterButtons() {
      for (const button of this.$taskFilters) {
         const active = button.dataset.filter === this._taskFilter;
         button.classList.toggle('dashboard-section__filter--active', active);
         button.setAttribute('aria-selected', active ? 'true' : 'false');
      }
   }

   renderDueToday(tasks, finances) {
      if (!this.$todayList) {
         return;
      }
      const today = todayISO();
      const rows = [];

      for (const task of Array.isArray(tasks) ? tasks : []) {
         if (task.completed) {
            continue;
         }
         const { end } = taskDateRange(task);
         if (end && end <= today) {
            rows.push({ kind: 'Tarea', label: task.title, route: '/planner', overdue: end < today });
         }
      }

      const dueFinances =
         typeof this.financeService?.getDueOnDate === 'function'
            ? this.financeService.getDueOnDate(today)
            : (Array.isArray(finances) ? finances : []).filter(
                 (item) => !item.settled && item.dueDate && item.dueDate <= today
              );
      for (const item of dueFinances) {
         rows.push({
            kind: item.type === 'receive' ? 'Cobro' : 'Pago',
            label: `${item.description} · ${this.formatMoney(item.amount)}`,
            route: '/finances',
            overdue: item.dueDate < today
         });
      }

      const dueShopping =
         typeof this.shoppingService?.getDueItems === 'function'
            ? this.shoppingService.getDueItems({ withinDays: 0 })
            : [];
      for (const item of dueShopping) {
         rows.push({
            kind: 'Compra',
            label: item.name,
            route: '/shopping',
            overdue: (item.nextDueAt ?? today) < today
         });
      }

      const notesService = slice.getComponent('notes-service');
      const notes = notesService?.getAll?.() ?? [];
      for (const note of notes) {
         if (note.archived || !note.remindAt) {
            continue;
         }
         const day = note.remindAt.slice(0, 10);
         if (day <= today) {
            rows.push({ kind: 'Nota', label: note.title, route: '/notes', overdue: day < today });
         }
      }

      rows.sort((a, b) => Number(b.overdue) - Number(a.overdue));

      this.$todayList.innerHTML = '';
      this.$todayEmpty.hidden = rows.length > 0;

      for (const row of rows.slice(0, 10)) {
         const li = document.createElement('li');
         li.className = 'dashboard-section__today-item';
         if (row.overdue) {
            li.classList.add('dashboard-section__today-item--overdue');
         }
         li.setAttribute('role', 'button');
         li.tabIndex = 0;

         const kind = document.createElement('span');
         kind.className = 'dashboard-section__today-kind';
         kind.textContent = row.kind;

         const label = document.createElement('span');
         label.className = 'dashboard-section__today-label';
         label.textContent = row.label;

         const state = document.createElement('span');
         state.className = 'dashboard-section__today-state';
         state.textContent = row.overdue ? 'Vencido' : 'Hoy';

         li.append(kind, label, state);
         const go = () => slice.router?.navigate?.(row.route);
         li.addEventListener('click', go);
         li.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
               event.preventDefault();
               go();
            }
         });
         this.$todayList.appendChild(li);
      }
   }

   createDomainBadge(domainId) {
      const domain = domainForTask(domainId, this.domainService);
      const badge = document.createElement('span');
      badge.className = 'lc-domain-badge';
      badge.style.setProperty('--domain-color', domain.color);
      badge.textContent = domain.name;
      return badge;
   }

   renderTaskView(pending, domains, tasks) {
      if (!this.$taskList) {
         return;
      }
      this.syncFilterButtons();

      if (this._taskFilter === DASHBOARD_TASK_FILTERS.DOMAIN) {
         this.renderDomainSummary(domains, tasks);
         return;
      }

      let rows = Array.isArray(pending) ? pending : [];
      if (this._taskFilter === DASHBOARD_TASK_FILTERS.URGENT) {
         rows = rows.filter((task) => task.urgency === 'high');
      } else if (this._taskFilter === DASHBOARD_TASK_FILTERS.BLOCKS) {
         rows = rows.filter((task) => task.blockId);
      }

      this.fillList(this.$taskList, rows.slice(0, 6), this._taskFilter !== DASHBOARD_TASK_FILTERS.BLOCKS);
      this.$taskEmpty.hidden = rows.length > 0;
      const emptyCopy = {
         [DASHBOARD_TASK_FILTERS.ALL]: 'Sin pendientes.',
         [DASHBOARD_TASK_FILTERS.URGENT]: 'Sin urgentes.',
         [DASHBOARD_TASK_FILTERS.BLOCKS]: 'Sin tareas en bloques.'
      };
      this.$taskEmpty.textContent = emptyCopy[this._taskFilter] ?? 'Sin pendientes.';
   }

   renderDomainSummary(domains, tasks) {
      const list = Array.isArray(domains) ? domains : [];
      const pending = (Array.isArray(tasks) ? tasks : []).filter((task) => !task.completed);
      this.$taskList.innerHTML = '';
      this.$taskEmpty.hidden = list.length > 0;
      this.$taskEmpty.textContent = 'Sin dominios.';

      for (const domain of list) {
         const count = pending.filter((task) => task.domainId === domain.id).length;
         const item = document.createElement('li');
         item.className = 'dashboard-section__domain-item';

         const meta = document.createElement('div');
         meta.className = 'dashboard-section__domain-meta';

         const badge = document.createElement('span');
         badge.className = 'lc-domain-badge';
         badge.style.setProperty('--domain-color', domain.color);
         badge.textContent = domain.name;

         meta.appendChild(badge);
         item.appendChild(meta);

         const countEl = document.createElement('span');
         countEl.className = 'dashboard-section__domain-count';
         countEl.textContent = `${count} pendiente${count === 1 ? '' : 's'}`;
         item.appendChild(countEl);

         this.$taskList.appendChild(item);
      }
   }

   renderRate(exchangeRate) {
      const status = exchangeRate?.status ?? 'idle';
      const canCalculate = Boolean(exchangeRate?.rate);

      if (this.$rateCard) {
         this.$rateCard.classList.toggle('dashboard-section__rate-card--clickable', canCalculate);
         this.$rateCard.setAttribute('aria-disabled', canCalculate ? 'false' : 'true');
      }

      if (exchangeRate?.rate) {
         const stale = Boolean(exchangeRate.stale) && status !== 'loading';
         this.$rate.textContent = `1 USD = ${Number(exchangeRate.rate).toFixed(2)} ${exchangeRate.target}${stale ? ' · sin conexión' : ''}`;
         this.$rateRetry.hidden = !stale && status !== 'error';
         return;
      }

      if (status === 'loading') {
         this.$rate.textContent = 'Cargando…';
         this.$rateRetry.hidden = true;
         return;
      }

      if (status === 'error') {
         this.$rate.textContent = 'Error';
         this.$rateRetry.hidden = false;
         return;
      }

      this.$rate.textContent = '—';
      this.$rateRetry.hidden = true;
   }

   fillList(listEl, tasks, withFlag) {
      listEl.innerHTML = '';
      for (const task of tasks) {
         const item = document.createElement('li');
         item.className = withFlag ? 'dashboard-section__urgent-item' : 'dashboard-section__recent-item';

         if (withFlag) {
            const flag = document.createElement('span');
            flag.className = `dashboard-section__flag dashboard-section__flag--${task.urgency || 'medium'}`;
            const title = document.createElement('span');
            title.textContent = task.title;
            item.append(flag, this.createDomainBadge(task.domainId), title);
         } else {
            item.append(this.createDomainBadge(task.domainId));
            const title = document.createElement('span');
            title.textContent = task.title;
            item.appendChild(title);
         }

         listEl.appendChild(item);
      }
   }
}

customElements.define('slice-dashboard-section', DashboardSection);
