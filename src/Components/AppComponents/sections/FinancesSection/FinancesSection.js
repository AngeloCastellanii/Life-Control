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
      this.$payList = this.querySelector('[data-role="pay-list"]');
      this.$receiveList = this.querySelector('[data-role="receive-list"]');
      this.$payEmpty = this.querySelector('[data-role="pay-empty"]');
      this.$receiveEmpty = this.querySelector('[data-role="receive-empty"]');
      this.$payTotal = this.querySelector('[data-role="pay-total"]');
      this.$receiveTotal = this.querySelector('[data-role="receive-total"]');
      this.$paySettledWrap = this.querySelector('[data-role="pay-settled-wrap"]');
      this.$receiveSettledWrap = this.querySelector('[data-role="receive-settled-wrap"]');
      this.$paySettledList = this.querySelector('[data-role="pay-settled-list"]');
      this.$receiveSettledList = this.querySelector('[data-role="receive-settled-list"]');
      this.$paySettledEmpty = this.querySelector('[data-role="pay-settled-empty"]');
      this.$receiveSettledEmpty = this.querySelector('[data-role="receive-settled-empty"]');
      this.$paySettledCount = this.querySelector('[data-role="pay-settled-count"]');
      this.$receiveSettledCount = this.querySelector('[data-role="receive-settled-count"]');
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
         li.className = 'finances-section__account finances-section__account--clickable';
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

         const head = document.createElement('div');
         head.className = 'finances-section__account-head';

         const name = document.createElement('span');
         name.className = 'finances-section__account-name';
         name.textContent = method.name;

         const amountWrap = document.createElement('div');
         amountWrap.className = 'finances-section__account-amounts';

         const amount = document.createElement('span');
         amount.className = 'finances-section__account-amount';
         amount.textContent = this.formatMoney(method.balance);

         const pctLabel = document.createElement('span');
         pctLabel.className = 'finances-section__account-pct';
         pctLabel.textContent = `${pct.toFixed(0)}% del total · ver movimientos`;

         amountWrap.append(amount, pctLabel);
         head.append(name, amountWrap);

         const bar = document.createElement('div');
         bar.className = 'finances-section__account-bar';
         const fill = document.createElement('span');
         fill.className = 'finances-section__account-fill';
         fill.style.width = `${pct}%`;
         bar.appendChild(fill);

         const actions = document.createElement('div');
         actions.className = 'finances-section__account-actions';

         const edit = document.createElement('button');
         edit.type = 'button';
         edit.className = 'finances-section__account-edit';
         edit.textContent = 'Editar';
         edit.addEventListener('click', (event) => {
            event.stopPropagation();
            this.openMethodForm(method.id);
         });
         actions.appendChild(edit);

         const remove = document.createElement('button');
         remove.type = 'button';
         remove.className = 'finances-section__account-delete';
         remove.textContent = 'Eliminar';
         remove.addEventListener('click', async (event) => {
            event.stopPropagation();
            const pool = this.paymentMethodService?.getPool?.();
            const refund =
               !method.isPool && pool
                  ? ` El saldo volverá a “${pool.name}”.`
                  : '';
            if (!confirm(`¿Eliminar “${method.name}”?${refund}`)) {
               return;
            }
            try {
               await this.paymentMethodService.remove(method.id);
            } catch (error) {
               alert(error.message || 'No se pudo eliminar.');
            }
         });
         actions.appendChild(remove);

         li.append(head, bar, actions);
         this.$accountsList.appendChild(li);
      }
   }

   renderItemRow(item, { settledSection = false } = {}) {
      const row = document.createElement('li');
      row.className = 'finances-section__item';
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
      body.className = 'finances-section__item-body finances-section__item-body--clickable';
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
      title.className = 'finances-section__item-title';
      title.textContent = item.description;

      const meta = document.createElement('span');
      meta.className = 'finances-section__item-meta';
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
      amount.className = 'finances-section__item-amount';
      amount.textContent = this.formatMoney(item.amount);
      row.appendChild(amount);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'finances-section__edit';
      editBtn.textContent = '✎';
      editBtn.setAttribute('aria-label', 'Editar');
      editBtn.addEventListener('click', (event) => {
         event.stopPropagation();
         this.openEdit(item.id);
      });
      row.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'finances-section__delete';
      deleteBtn.textContent = '×';
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
      const payPending = list.filter((item) => item.type === FINANCE_TYPE.PAY && !item.settled);
      const paySettled = list.filter((item) => item.type === FINANCE_TYPE.PAY && item.settled);
      const receivePending = list.filter((item) => item.type === FINANCE_TYPE.RECEIVE && !item.settled);
      const receiveSettled = list.filter((item) => item.type === FINANCE_TYPE.RECEIVE && item.settled);

      this.$payTotal.textContent = this.formatMoney(this.pendingTotal(list, FINANCE_TYPE.PAY));
      this.$receiveTotal.textContent = this.formatMoney(this.pendingTotal(list, FINANCE_TYPE.RECEIVE));

      this.renderItemList(this.$payList, this.$payEmpty, payPending);
      this.renderItemList(this.$receiveList, this.$receiveEmpty, receivePending);

      this.renderSettledSection(
         this.$paySettledWrap,
         this.$paySettledList,
         this.$paySettledEmpty,
         this.$paySettledCount,
         paySettled
      );
      this.renderSettledSection(
         this.$receiveSettledWrap,
         this.$receiveSettledList,
         this.$receiveSettledEmpty,
         this.$receiveSettledCount,
         receiveSettled
      );
   }
}

customElements.define('slice-finances-section', FinancesSection);
