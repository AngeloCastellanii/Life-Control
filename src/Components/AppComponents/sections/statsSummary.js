import { startOfWeek, todayISO } from './plannerDates.js';

export function money(value) {
   return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthPrefix(iso = todayISO()) {
   return iso.slice(0, 7);
}

function financeMonth(item) {
   const ref = item.settledAt || item.dueDate || (item.createdAt ? item.createdAt.slice(0, 10) : null);
   return ref ? ref.slice(0, 7) : null;
}

export function computeStats({ tasks = [], finances = [], domains = [], notes = [] } = {}) {
   const weekStart = startOfWeek(todayISO());
   const completed = tasks.filter((task) => task.completed);
   const completedWeek = completed.filter((task) => (task.completedAt ?? '') >= weekStart);
   const pending = tasks.filter((task) => !task.completed);
   const month = monthPrefix();
   const settledMonth = finances
      .filter((item) => item.settled && item.type === 'pay' && financeMonth(item) === month)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

   return {
      month,
      doneTotal: completed.length,
      doneWeek: completedWeek.length,
      pendingTotal: pending.length,
      high: pending.filter((task) => task.urgency === 'high').length,
      medium: pending.filter((task) => task.urgency === 'medium').length,
      low: pending.filter((task) => task.urgency === 'low').length,
      settledMonth,
      notesTotal: notes.filter((note) => !note.archived).length,
      remindersTotal: notes.filter((note) => note.remindAt && !note.archived).length
   };
}

export function budgetRows(domains = [], finances = [], month = monthPrefix()) {
   return (Array.isArray(domains) ? domains : [])
      .filter((domain) => Number(domain.monthlyBudget) > 0)
      .map((domain) => {
         const spent = finances
            .filter((item) => item.type === 'pay' && item.domainId === domain.id && financeMonth(item) === month)
            .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
         const budget = Number(domain.monthlyBudget);
         const ratio = budget > 0 ? spent / budget : 0;
         return {
            domain,
            spent,
            budget,
            pct: Math.min(100, Math.round(ratio * 100)),
            over: spent > budget
         };
      });
}

export function fillBudgetList(listEl, emptyEl, rows) {
   if (!listEl) {
      return;
   }
   listEl.innerHTML = '';
   if (emptyEl) {
      emptyEl.hidden = rows.length > 0;
   }
   for (const row of rows) {
      const li = document.createElement('li');
      li.className = 'stats-section__budget';

      const head = document.createElement('div');
      head.className = 'stats-section__budget-head';

      const name = document.createElement('span');
      name.className = 'stats-section__budget-name';
      const dot = document.createElement('span');
      dot.className = 'stats-section__budget-dot';
      dot.style.background = row.domain.color || '#6366f1';
      name.append(dot, document.createTextNode(row.domain.name));

      const amount = document.createElement('span');
      amount.className = 'stats-section__budget-amount';
      amount.classList.toggle('stats-section__budget-amount--over', row.over);
      amount.textContent = `${money(row.spent)} / ${money(row.budget)}`;
      head.append(name, amount);

      const bar = document.createElement('div');
      bar.className = 'stats-section__budget-bar';
      const fill = document.createElement('div');
      fill.className = 'stats-section__budget-fill';
      fill.classList.toggle('stats-section__budget-fill--over', row.over);
      fill.style.width = `${row.pct}%`;
      fill.style.setProperty('--budget-color', row.over ? '#ef4444' : row.domain.color || '#6366f1');
      bar.appendChild(fill);

      li.append(head, bar);
      listEl.appendChild(li);
   }
}
