import { FINANCE_TYPE } from '../lifeControlConstants.js';

export default class FinancesSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'finances-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$walletBalance = this.querySelector('[data-role="wallet-balance"]');
      this.$addMethod = this.querySelector('[data-role="add-method"]');
      this.$accountsList = this.querySelector('[data-role="accounts-list"]');
      this.$accountsEmpty = this.querySelector('[data-role="accounts-empty"]');
      this.$filter = this.querySelector('[data-role="movement-filter"]');
      this.$filterTotal = this.querySelector('[data-role="filter-total"]');
      this.$movementList = this.querySelector('[data-role="movement-list"]');
      this.$movementEmpty = this.querySelector('[data-role="movement-empty"]');
      this._movementFilter = 'pay';
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.financeService = slice.getComponent('finance-service');
      this.paymentMethodService = slice.getComponent('payment-method-service');
      if (typeof this.financeService?.getAll !== 'function') {
         slice.logger.logError('FinancesSection', 'FinanceService no disponible');
         return;
      }

      this.$addMethod?.addEventListener('click', (event) => {
         event.preventDefault();
         event.stopPropagation();
         this.openMethodForm();
      });

      this.querySelector('[data-role="open-all-ledger"]')?.addEventListener('click', (event) => {
         event.preventDefault();
         event.stopPropagation();
         this.openMethodLedger('all');
      });

      this.$filter?.addEventListener('click', (event) => {
         const button = event.target.closest('[data-filter]');
         if (!button) {
            return;
         }
         this._movementFilter = button.dataset.filter;
         this.renderFromState();
      });

      this.$walletBalance?.addEventListener('click', (event) => {
         event.preventDefault();
         event.stopPropagation();
         this.openMethodLedger('all');
      });

      slice.context.watch(
         'lifeControl',
         this,
         (state) => this.render(state),
         (state) => ({
            finances: state?.finances ?? [],
            walletBalance: state?.walletBalance ?? 0,
            paymentMethods: state?.paymentMethods ?? []
         })
      );

      this.renderFromState();
   }

   async update() {
      this.financeService = slice.getComponent('finance-service');
      this.paymentMethodService = slice.getComponent('payment-method-service');
      this.renderFromState();
   }

   renderFromState() {
      const state = slice.context.getState('lifeControl') ?? {};
      this.render({
         finances: state.finances ?? [],
         walletBalance: state.walletBalance ?? 0,
         paymentMethods: state.paymentMethods ?? []
      });
   }

   formatMoney(value) {
      return `$${(Number(value) || 0).toFixed(2)}`;
   }

   formatDate(iso) {
      if (!iso) {
         return '';
      }
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
   }

   methodName(accountId) {
      return this.paymentMethodService?.getById?.(accountId)?.name ?? '';
   }

   openMethodForm(paymentMethodId = null) {
      slice.events.emit('ui:modal:open', {
         title: paymentMethodId ? 'Editar método de pago' : 'Nuevo método de pago',
         form: 'PaymentMethodForm',
         paymentMethodId
      });
   }

   openMethodLedger(paymentMethodId = 'all') {
      const method =
         paymentMethodId && paymentMethodId !== 'all'
            ? this.paymentMethodService?.getById?.(paymentMethodId)
            : null;
      slice.events.emit('ui:modal:open', {
         title: method ? `Movimientos · ${method.name}` : 'Movimientos del fondo',
         form: 'PaymentMethodLedgerPanel',
         paymentMethodId: paymentMethodId || 'all'
      });
   }

   openEdit(financeId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar transacción',
         form: 'FinanceForm',
         financeId
      });
   }

   openDetail(financeId) {
      slice.events.emit('ui:modal:open', {
         title: 'Detalle de transacción',
         form: 'FinanceDetailPanel',
         financeId
      });
   }

   renderAccounts(methods, total) {
      this.$accountsList.innerHTML = '';
      const list = Array.isArray(methods) ? [...methods] : [];
      list.sort((a, b) => {
         if (Boolean(a.isPool) !== Boolean(b.isPool)) {
            return a.isPool ? -1 : 1;
         }
         return (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name));
      });
      this.$accountsEmpty.hidden = list.length > 0;

      for (const method of list) {
         const li = document.createElement('li');
         li.className = 'finances-section__method';
         if (method.isPool) {
            li.classList.add('finances-section__account--general');
         }
         li.style.setProperty('--account-color', method.color || '#6366f1');
         li.tabIndex = 0;
         li.setAttribute('role', 'button');
         li.setAttribute('aria-label', `Ver movimientos de ${method.name}`);

         const openLedger = () => this.openMethodLedger(method.id);
         li.addEventListener('click', (event) => {
            if (event.target.closest('button')) {
               return;
            }
            openLedger();
         });
         li.addEventListener('keydown', (event) => {
            if (event.target.closest('button')) {
               return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
               event.preventDefault();
               openLedger();
            }
         });

         const pct = total > 0 ? Math.min(100, (Math.abs(method.balance) / total) * 100) : 0;

         const name = document.createElement('span');
         name.className = 'finances-section__method-name';
         name.textContent = method.name;

         const amount = document.createElement('span');
         amount.className = 'finances-section__method-amount';
         amount.textContent = this.formatMoney(method.balance);

         const share = document.createElement('span');
         share.className = 'finances-section__method-share';
         share.textContent = `${pct.toFixed(0)}%`;

         li.append(name, amount, share);
         this.$accountsList.appendChild(li);
      }
   }

   renderItemRow(item, { settledSection = false } = {}) {
      const row = document.createElement('li');
      row.className = 'lc-row finances-section__item';
      if (item.settled || settledSection) {
         row.classList.add('finances-section__item--settled');
      }

      const checkWrap = document.createElement('label');
      checkWrap.className = 'finances-section__check-wrap';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = !!item.settled;
      check.addEventListener('change', () => {
         this.financeService?.toggleSettled?.(item.id, check.checked);
      });

      checkWrap.appendChild(check);
      row.appendChild(checkWrap);

      const body = document.createElement('div');
      body.className = 'lc-row__main finances-section__item-body finances-section__item-body--clickable';
      body.tabIndex = 0;
      body.setAttribute('role', 'button');
      body.setAttribute('aria-label', `Ver detalle: ${item.description}`);

      const openDetail = () => this.openDetail(item.id);
      body.addEventListener('click', openDetail);
      body.addEventListener('keydown', (event) => {
         if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
         }
      });

      const title = document.createElement('span');
      title.className = 'lc-row__title finances-section__item-title';
      title.textContent = item.description;

      const meta = document.createElement('span');
      meta.className = 'lc-row__meta finances-section__item-meta';
      const isPay = item.type === FINANCE_TYPE.PAY;
      const method = this.methodName(item.accountId);
      const bits = [];
      if (method) {
         bits.push(method);
      }
      if (item.settled) {
         bits.push(item.settledAt ? `${isPay ? 'Pagado' : 'Cobrado'} ${this.formatDate(item.settledAt)}` : isPay ? 'Pagado' : 'Cobrado');
      } else if (item.dueDate) {
         bits.push(`Vence ${this.formatDate(item.dueDate)}`);
      } else {
         bits.push('Pendiente');
      }
      meta.textContent = bits.join(' · ');

      body.appendChild(title);
      body.appendChild(meta);
      row.appendChild(body);

      const amount = document.createElement('span');
      amount.className = 'lc-row__amount finances-section__item-amount';
      amount.textContent = this.formatMoney(item.amount);
      row.appendChild(amount);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'lc-icon-btn finances-section__edit';
      editBtn.innerHTML =
         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 20h4l10.5-10.5-4-4L4 16v4z" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke-linecap="round"/></svg>';
      editBtn.setAttribute('aria-label', 'Editar');
      editBtn.addEventListener('click', (event) => {
         event.stopPropagation();
         this.openEdit(item.id);
      });
      row.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'lc-icon-btn lc-icon-btn--danger finances-section__delete';
      deleteBtn.innerHTML =
         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      deleteBtn.setAttribute('aria-label', 'Eliminar');
      deleteBtn.addEventListener('click', (event) => {
         event.stopPropagation();
         this.financeService?.remove?.(item.id);
      });
      row.appendChild(deleteBtn);

      return row;
   }

   renderItemList(listEl, emptyEl, items, { settledSection = false } = {}) {
      listEl.innerHTML = '';
      emptyEl.hidden = items.length > 0;

      for (const item of items) {
         listEl.appendChild(this.renderItemRow(item, { settledSection }));
      }
   }

   renderSettledSection(wrapEl, listEl, emptyEl, countEl, items) {
      const hasSettled = items.length > 0;
      wrapEl.hidden = !hasSettled;
      countEl.textContent = String(items.length);
      this.renderItemList(listEl, emptyEl, items, { settledSection: true });
   }

   pendingTotal(list, type) {
      return list
         .filter((item) => item.type === type && !item.settled)
         .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
   }

   render({ finances, walletBalance, paymentMethods }) {
      if (!this.$walletBalance) {
         return;
      }

      const methods = Array.isArray(paymentMethods) ? paymentMethods : [];
      const total =
         methods.length > 0
            ? methods.reduce((sum, method) => sum + (Number(method.balance) || 0), 0)
            : walletBalance;

      this.$walletBalance.textContent = this.formatMoney(total);
      this.renderAccounts(methods, total);

      const list = Array.isArray(finances) ? finances : [];
      const filter = this._movementFilter || 'pay';
      for (const button of this.$filter?.querySelectorAll('[data-filter]') ?? []) {
         button.classList.toggle('lc-segment__btn--active', button.dataset.filter === filter);
      }

      let items = [];
      let emptyText = 'Sin pendientes por pagar.';
      if (filter === 'receive') {
         items = list.filter((item) => item.type === FINANCE_TYPE.RECEIVE && !item.settled);
         emptyText = 'Sin pendientes por cobrar.';
         this.$filterTotal.textContent = this.formatMoney(this.pendingTotal(list, FINANCE_TYPE.RECEIVE));
      } else if (filter === 'done') {
         items = list.filter((item) => item.settled);
         emptyText = 'Sin movimientos hechos.';
         this.$filterTotal.textContent = `${items.length}`;
      } else {
         items = list.filter((item) => item.type === FINANCE_TYPE.PAY && !item.settled);
         this.$filterTotal.textContent = this.formatMoney(this.pendingTotal(list, FINANCE_TYPE.PAY));
      }

      this.$movementEmpty.textContent = emptyText;
      this.renderItemList(this.$movementList, this.$movementEmpty, items, {
         settledSection: filter === 'done'
      });
   }
}

customElements.define('slice-finances-section', FinancesSection);
