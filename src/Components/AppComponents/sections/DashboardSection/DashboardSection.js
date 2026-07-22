import { FINANCE_TYPE } from '../lifeControlConstants.js';
import { getDueStatus } from '../shoppingDue.js';
import { formatDayLong, taskShowsOnCalendarDay, daysUntil, todayISO, taskDateRange } from '../plannerDates.js';
import { domainForTask } from '../domainLookup.js';
import { greetingForName } from '../profileGreeting.js';

const FREQUENCY_LABELS = {
   daily: 'Diaria',
   weekly: 'Semanal',
   monthly: 'Mensual',
   yearly: 'Anual'
};

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
      this.$pendingCount = this.querySelector('[data-role="pending-count"]');
      this.$tasksCount = this.querySelector('[data-role="tasks-count"]');
      this.$blocksCount = this.querySelector('[data-role="blocks-count"]');
      this.$rate = this.querySelector('[data-role="rate"]');
      this.$rateCard = this.querySelector('[data-role="rate-card"]');
      this.$rateRetry = this.querySelector('[data-role="rate-retry"]');
      this.$financePay = this.querySelector('[data-role="finance-pay"]');
      this.$financeReceive = this.querySelector('[data-role="finance-receive"]');
      this.$shoppingDueList = this.querySelector('[data-role="shopping-due-list"]');
      this.$shoppingDueEmpty = this.querySelector('[data-role="shopping-due-empty"]');
      this.$netLiquidity = this.querySelector('[data-role="net-liquidity"]');
      this.$netBs = this.querySelector('[data-role="net-bs"]');
      this.$priorityList = this.querySelector('[data-role="priority-list"]');
      this.$priorityEmpty = this.querySelector('[data-role="priority-empty"]');
      this.$recentList = this.querySelector('[data-role="recent-list"]');
      this.$recentEmpty = this.querySelector('[data-role="recent-empty"]');
      this.$domainSummaryList = this.querySelector('[data-role="domain-summary-list"]');
      this.$domainSummaryEmpty = this.querySelector('[data-role="domain-summary-empty"]');
      this.$todayList = this.querySelector('[data-role="today-list"]');
      this.$todayEmpty = this.querySelector('[data-role="today-empty"]');
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
            shopping: state?.shopping ?? []
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

   shoppingCountdownLabel(item, status) {
      if (status.state === 'renew') {
         return status.label;
      }
      if (status.state === 'done') {
         const days = daysUntil(item.nextDueAt);
         if (days <= 0) {
            return 'faltan 0 días';
         }
         return days === 1 ? 'falta 1 día' : `faltan ${days} días`;
      }
      const days = daysUntil(item.nextDueAt);
      if (days < 0) {
         const overdue = Math.abs(days);
         return overdue === 1 ? 'vencido hace 1 día' : `vencido hace ${overdue} días`;
      }
      if (days === 0) {
         return 'faltan 0 días';
      }
      return days === 1 ? 'falta 1 día' : `faltan ${days} días`;
   }

   openExchangeCalculator() {
      const exchangeRate = slice.context.getState('lifeControl')?.exchangeRate ?? {};
      if (exchangeRate.status !== 'success' || !exchangeRate.rate) {
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
      this.$capacityText.textContent = `${completedToday} / ${totalToday} tareas completadas`;
      this.$pendingCount.textContent = `${pending.length} pendientes`;
      this.$tasksCount.textContent = String(pending.length);
      this.$blocksCount.textContent = String(timeBlocks.length);

      this.renderRate(exchangeRate);
      this.renderFinances(finances);
      this.renderShoppingDue();
      this.renderIncomingLiquidity(finances, exchangeRate);
      this.renderDueToday(tasks, finances);
      this.renderLists(pending, tasks);
      this.renderDomainSummary(domains ?? this.domainService?.getAll?.() ?? [], tasks);
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
         if (!note.remindAt) {
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

   renderDomainSummary(domains, tasks) {
      const list = Array.isArray(domains) ? domains : [];
      const pending = (Array.isArray(tasks) ? tasks : []).filter((task) => !task.completed);

      this.$domainSummaryList.innerHTML = '';
      this.$domainSummaryEmpty.hidden = list.length > 0;

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

         this.$domainSummaryList.appendChild(item);
      }
   }

   renderRate(exchangeRate) {
      const status = exchangeRate?.status ?? 'idle';
      const canCalculate = status === 'success' && exchangeRate.rate;

      if (this.$rateCard) {
         this.$rateCard.classList.toggle('dashboard-section__rate-card--clickable', !!canCalculate);
         this.$rateCard.setAttribute('aria-disabled', canCalculate ? 'false' : 'true');
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

      if (status === 'success' && exchangeRate.rate) {
         this.$rate.textContent = `1 USD = ${exchangeRate.rate.toFixed(2)} ${exchangeRate.target}`;
         this.$rateRetry.hidden = true;
         return;
      }

      this.$rate.textContent = '—';
      this.$rateRetry.hidden = true;
   }

   renderFinances(finances) {
      const list = Array.isArray(finances) ? finances : [];
      const payTotal = list
         .filter((item) => item.type === FINANCE_TYPE.PAY && !item.settled)
         .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const receiveTotal = list
         .filter((item) => item.type === FINANCE_TYPE.RECEIVE && !item.settled)
         .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      this.$financePay.textContent = this.formatMoney(payTotal);
      this.$financeReceive.textContent = this.formatMoney(receiveTotal);
   }

   renderIncomingLiquidity(finances, exchangeRate) {
      const incoming = (Array.isArray(finances) ? finances : [])
         .filter((item) => item.type === FINANCE_TYPE.RECEIVE && !item.settled)
         .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      this.$netLiquidity.textContent = `${this.formatMoney(incoming)} USD`;

      const rate = exchangeRate?.status === 'success' ? exchangeRate.rate : null;
      if (rate) {
         this.$netBs.hidden = false;
         this.$netBs.textContent = `• Bs. ${(incoming * rate).toFixed(2)}`;
      } else {
         this.$netBs.hidden = true;
      }
   }

   renderShoppingDue() {
      const items =
         typeof this.shoppingService?.getDueItems === 'function'
            ? this.shoppingService.getDueItems()
            : [];
      this.$shoppingDueList.innerHTML = '';
      this.$shoppingDueEmpty.hidden = items.length > 0;

      for (const item of items.slice(0, 6)) {
         const status = getDueStatus(item);
         const li = document.createElement('li');
         li.className = `dashboard-section__due-item dashboard-section__due-item--${status.state}`;

         const name = document.createElement('span');
         name.className = 'dashboard-section__due-name';
         name.textContent = item.name;

         const meta = document.createElement('span');
         meta.className = 'dashboard-section__due-meta';
         const countdown = this.shoppingCountdownLabel(item, status);
         const priceBit =
            item.price != null && Number(item.price) > 0
               ? ` · $${Number(item.price).toFixed(2)}`
               : '';
         meta.textContent = `${FREQUENCY_LABELS[item.frequency] ?? ''} · ${countdown}${priceBit}`;

         li.appendChild(name);
         li.appendChild(meta);
         this.$shoppingDueList.appendChild(li);
      }
   }

   renderLists(tasks) {
      const urgent = tasks.filter((task) => task.urgency === 'high').slice(0, 5);
      const inBlocks = tasks.filter((task) => task.blockId && !task.completed).slice(0, 5);

      this.fillList(this.$priorityList, urgent, true);
      this.$priorityEmpty.hidden = urgent.length > 0;

      this.fillList(this.$recentList, inBlocks, false);
      this.$recentEmpty.hidden = inBlocks.length > 0;
   }

   fillList(listEl, tasks, withFlag) {
      listEl.innerHTML = '';
      for (const task of tasks) {
         const item = document.createElement('li');
         item.className = withFlag ? 'dashboard-section__urgent-item' : 'dashboard-section__recent-item';

         if (withFlag) {
            const flag = document.createElement('span');
            flag.className = `dashboard-section__flag dashboard-section__flag--${task.urgency || 'high'}`;
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
