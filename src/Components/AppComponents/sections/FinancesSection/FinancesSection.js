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
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.financeService = slice.getComponent('finance-service');
      if (!this.financeService) {
         slice.logger.logError('FinancesSection', 'FinanceService no disponible');
         return;
      }

      this.$walletAdjust.addEventListener('click', () => this.adjustWallet());

      slice.context.watch(
         'lifeControl',
         this,
         (state) => this.render(state),
         (state) => ({
            finances: state?.finances ?? [],
            walletBalance: state?.walletBalance ?? 0
         })
      );

      this.render({
         finances: this.financeService.getAll(),
         walletBalance: this.financeService.getWalletBalance()
      });
   }

   formatMoney(value) {
      return `$${(Number(value) || 0).toFixed(2)}`;
   }

   async adjustWallet() {
      const current = this.financeService.getWalletBalance();
      const input = window.prompt('Saldo actual en USD (billetera):', current.toFixed(2));
      if (input === null) {
         return;
      }

      const value = Number(input.replace(',', '.'));
      if (!Number.isFinite(value) || value < 0) {
         window.alert('Ingresa un monto válido.');
         return;
      }

      await this.financeService.setWalletBalance(value);
   }

   renderColumn(listEl, emptyEl, items, settledLabel) {
      listEl.innerHTML = '';
      emptyEl.hidden = items.length > 0;

      for (const item of items) {
         const row = document.createElement('li');
         row.className = 'finances-section__item';
         if (item.settled) {
            row.classList.add('finances-section__item--settled');
         }

         const checkWrap = document.createElement('label');
         checkWrap.className = 'finances-section__check-wrap';

         const check = document.createElement('input');
         check.type = 'checkbox';
         check.checked = !!item.settled;
         check.addEventListener('change', () => {
            this.financeService.toggleSettled(item.id, check.checked);
         });

         checkWrap.appendChild(check);
         row.appendChild(checkWrap);

         const body = document.createElement('div');
         body.className = 'finances-section__item-body';

         const title = document.createElement('span');
         title.className = 'finances-section__item-title';
         title.textContent = item.description;

         const meta = document.createElement('span');
         meta.className = 'finances-section__item-meta';
         meta.textContent = item.settled ? settledLabel : 'Pendiente';

         body.appendChild(title);
         body.appendChild(meta);
         row.appendChild(body);

         const amount = document.createElement('span');
         amount.className = 'finances-section__item-amount';
         amount.textContent = this.formatMoney(item.amount);
         row.appendChild(amount);

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'finances-section__delete';
         deleteBtn.textContent = '×';
         deleteBtn.setAttribute('aria-label', 'Eliminar');
         deleteBtn.addEventListener('click', () => this.financeService.remove(item.id));
         row.appendChild(deleteBtn);

         listEl.appendChild(row);
      }
   }

   render({ finances, walletBalance }) {
      this.$walletBalance.textContent = this.formatMoney(walletBalance);

      const list = Array.isArray(finances) ? finances : this.financeService.getAll();
      const payItems = list.filter((item) => item.type === FINANCE_TYPE.PAY);
      const receiveItems = list.filter((item) => item.type === FINANCE_TYPE.RECEIVE);

      this.$payTotal.textContent = this.formatMoney(this.financeService.pendingTotal(FINANCE_TYPE.PAY));
      this.$receiveTotal.textContent = this.formatMoney(this.financeService.pendingTotal(FINANCE_TYPE.RECEIVE));

      this.renderColumn(this.$payList, this.$payEmpty, payItems, 'Pagado');
      this.renderColumn(this.$receiveList, this.$receiveEmpty, receiveItems, 'Cobrado');
   }
}

customElements.define('slice-finances-section', FinancesSection);
