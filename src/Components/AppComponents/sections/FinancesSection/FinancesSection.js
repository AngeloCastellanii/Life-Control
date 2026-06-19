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
      this.$walletAdjust = this.querySelector('[data-role="wallet-adjust"]');
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
      if (typeof this.financeService?.getAll !== 'function') {
         slice.logger.logError('FinancesSection', 'FinanceService no disponible');
         return;
      }

      if (this.$walletAdjust) {
         this.$walletAdjust.addEventListener('click', () => this.adjustWallet());
      }

      slice.context.watch(
         'lifeControl',
         this,
         (state) => this.render(state),
         (state) => ({
            finances: state?.finances ?? [],
            walletBalance: state?.walletBalance ?? 0
         })
      );

      this.renderFromState();
   }

   async update() {
      this.financeService = slice.getComponent('finance-service');
      this.renderFromState();
   }

   renderFromState() {
      const state = slice.context.getState('lifeControl') ?? {};
      this.render({
         finances: state.finances ?? [],
         walletBalance: state.walletBalance ?? 0
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

   adjustWallet() {
      slice.events.emit('ui:modal:open', {
         title: 'Ajustar saldo de billetera',
         form: 'WalletForm'
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
      if (item.settled) {
         const label = isPay ? 'Pagado' : 'Cobrado';
         meta.textContent = item.settledAt ? `${label} el ${this.formatDate(item.settledAt)}` : label;
      } else if (item.dueDate) {
         meta.textContent = `Vence ${this.formatDate(item.dueDate)}`;
      } else {
         meta.textContent = 'Pendiente';
      }

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

   render({ finances, walletBalance }) {
      if (!this.$walletBalance) {
         return;
      }

      this.$walletBalance.textContent = this.formatMoney(walletBalance);

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
