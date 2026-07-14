import { startOfWeek, todayISO } from '../plannerDates.js';

function money(value) {
   return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthPrefix(iso = todayISO()) {
   return iso.slice(0, 7);
}

function financeMonth(item) {
   const ref = item.settledAt || item.dueDate || (item.createdAt ? item.createdAt.slice(0, 10) : null);
   return ref ? ref.slice(0, 7) : null;
}

export default class StatsSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'stats-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$doneTotal = this.querySelector('[data-role="done-total"]');
      this.$doneWeek = this.querySelector('[data-role="done-week"]');
      this.$pendingTotal = this.querySelector('[data-role="pending-total"]');
      this.$pendingBreakdown = this.querySelector('[data-role="pending-breakdown"]');
      this.$settledMonth = this.querySelector('[data-role="settled-month"]');
      this.$notesTotal = this.querySelector('[data-role="notes-total"]');
      this.$remindersTotal = this.querySelector('[data-role="reminders-total"]');
      this.$budgetList = this.querySelector('[data-role="budget-list"]');
      this.$budgetEmpty = this.querySelector('[data-role="budget-empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      slice.context.watch(
         'lifeControl',
         this,
         () => this.render(),
         (state) => ({
            tasks: state?.tasks ?? [],
            finances: state?.finances ?? [],
            domains: state?.domains ?? [],
            notes: state?.notes ?? []
         })
      );
      this.render();
   }

   render() {
      const state = slice.context.getState('lifeControl') ?? {};
      const tasks = state.tasks ?? [];
      const finances = state.finances ?? [];
      const domains = state.domains ?? [];
      const notes = state.notes ?? [];

      const weekStart = startOfWeek(todayISO());
      const completed = tasks.filter((t) => t.completed);
      const completedWeek = completed.filter((t) => (t.completedAt ?? '') >= weekStart);
      this.$doneTotal.textContent = String(completed.length);
      this.$doneWeek.textContent = `${completedWeek.length} esta semana`;

      const pending = tasks.filter((t) => !t.completed);
      const high = pending.filter((t) => t.urgency === 'high').length;
      const medium = pending.filter((t) => t.urgency === 'medium').length;
      const low = pending.filter((t) => t.urgency === 'low').length;
      this.$pendingTotal.textContent = String(pending.length);
      this.$pendingBreakdown.textContent = `${high} alta · ${medium} media · ${low} baja`;

      const month = monthPrefix();
      const settledMonth = finances
         .filter((f) => f.settled && f.type === 'pay' && financeMonth(f) === month)
         .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
      this.$settledMonth.textContent = money(settledMonth);

      this.$notesTotal.textContent = String(notes.length);
      this.$remindersTotal.textContent = `${notes.filter((n) => n.remindAt).length} con recordatorio`;

      this.renderBudgets(domains, finances, month);
   }

   renderBudgets(domains, finances, month) {
      this.$budgetList.innerHTML = '';
      const budgeted = domains.filter((d) => Number(d.monthlyBudget) > 0);
      this.$budgetEmpty.hidden = budgeted.length > 0;

      for (const domain of budgeted) {
         const spent = finances
            .filter((f) => f.type === 'pay' && f.domainId === domain.id && financeMonth(f) === month)
            .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
         const budget = Number(domain.monthlyBudget);
         const ratio = budget > 0 ? spent / budget : 0;
         const pct = Math.min(100, Math.round(ratio * 100));
         const over = spent > budget;

         const li = document.createElement('li');
         li.className = 'stats-section__budget';

         const head = document.createElement('div');
         head.className = 'stats-section__budget-head';

         const name = document.createElement('span');
         name.className = 'stats-section__budget-name';
         const dot = document.createElement('span');
         dot.className = 'stats-section__budget-dot';
         dot.style.background = domain.color || '#6366f1';
         name.append(dot, document.createTextNode(domain.name));

         const amount = document.createElement('span');
         amount.className = 'stats-section__budget-amount';
         amount.classList.toggle('stats-section__budget-amount--over', over);
         amount.textContent = `${money(spent)} / ${money(budget)}`;

         head.append(name, amount);

         const bar = document.createElement('div');
         bar.className = 'stats-section__budget-bar';
         const fill = document.createElement('div');
         fill.className = 'stats-section__budget-fill';
         fill.classList.toggle('stats-section__budget-fill--over', over);
         fill.style.width = `${pct}%`;
         fill.style.setProperty('--budget-color', over ? '#ef4444' : domain.color || '#6366f1');
         bar.appendChild(fill);

         li.append(head, bar);
         this.$budgetList.appendChild(li);
      }
   }
}

customElements.define('slice-stats-section', StatsSection);
