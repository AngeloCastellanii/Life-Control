import { FINANCE_TYPE } from '../../sections/lifeControlConstants.js';

export default class PaymentMethodLedgerPanel extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'payment-method-ledger-panel' },
      paymentMethodId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$title = this.querySelector('[data-role="title"]');
      this.$subtitle = this.querySelector('[data-role="subtitle"]');
      this.$balance = this.querySelector('[data-role="balance"]');
      this.$totalIn = this.querySelector('[data-role="total-in"]');
      this.$totalOut = this.querySelector('[data-role="total-out"]');
      this.$list = this.querySelector('[data-role="list"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.financeService = slice.getComponent('finance-service');
      this.paymentMethodService = slice.getComponent('payment-method-service');

      slice.context.watch(
         'lifeControl',
         this,
         () => this.paint(),
         (state) => ({
            finances: state?.finances ?? [],
            paymentMethods: state?.paymentMethods ?? [],
            walletBalance: state?.walletBalance ?? 0
         })
      );

      this.paint();
   }

   async update() {
      this.financeService = slice.getComponent('finance-service');
      this.paymentMethodService = slice.getComponent('payment-method-service');
      this.paint();
   }

   formatMoney(value) {
      return `$${(Number(value) || 0).toFixed(2)}`;
   }

   formatDate(iso) {
      if (!iso) {
         return '—';
      }
      const [y, m, d] = String(iso).slice(0, 10).split('-');
      if (!y || !m || !d) {
         return '—';
      }
      return `${d}/${m}/${y}`;
   }

   isAll() {
      return !this.paymentMethodId || this.paymentMethodId === 'all';
   }

   method() {
      if (this.isAll()) {
         return null;
      }
      return this.paymentMethodService?.getById?.(this.paymentMethodId) ?? null;
   }

   transactions() {
      const list = this.financeService?.getAll?.() ?? [];
      if (this.isAll()) {
         return [...list];
      }
      return list.filter((item) => item.accountId === this.paymentMethodId);
   }

   openDetail(financeId) {
      slice.events.emit('ui:modal:open', {
         title: 'Detalle de transacción',
         form: 'FinanceDetailPanel',
         financeId
      });
   }

   paint() {
      const method = this.method();
      const items = this.transactions().sort((a, b) => {
         const aDate = a.settledAt || a.dueDate || a.createdAt || '';
         const bDate = b.settledAt || b.dueDate || b.createdAt || '';
         return String(bDate).localeCompare(String(aDate));
      });

      if (this.isAll()) {
         this.$title.textContent = 'Todos los movimientos';
         this.$subtitle.textContent = 'Entradas y salidas de todos los métodos';
         const total = this.paymentMethodService?.getTotalBalance?.()
            ?? slice.context.getState('lifeControl')?.walletBalance
            ?? 0;
         this.$balance.textContent = this.formatMoney(total);
      } else if (method) {
         this.$title.textContent = method.name;
         this.$subtitle.textContent = 'Movimientos de este método';
         this.$balance.textContent = this.formatMoney(method.balance);
         this.style.setProperty('--ledger-color', method.color || 'var(--primary-color)');
      } else {
         this.$title.textContent = 'Método no encontrado';
         this.$subtitle.textContent = '';
         this.$balance.textContent = '';
      }

      let totalIn = 0;
      let totalOut = 0;
      for (const item of items) {
         const amount = Number(item.amount) || 0;
         if (item.type === FINANCE_TYPE.RECEIVE) {
            totalIn += amount;
         } else {
            totalOut += amount;
         }
      }
      this.$totalIn.textContent = this.formatMoney(totalIn);
      this.$totalOut.textContent = this.formatMoney(totalOut);

      this.$list.innerHTML = '';
      this.$empty.hidden = items.length > 0;

      for (const item of items) {
         const isPay = item.type === FINANCE_TYPE.PAY;
         const settled = !!item.settled;
         const li = document.createElement('li');
         li.className = `payment-method-ledger__item payment-method-ledger__item--${isPay ? 'out' : 'in'}`;
         if (!settled) {
            li.classList.add('payment-method-ledger__item--pending');
         }
         li.tabIndex = 0;
         li.setAttribute('role', 'button');
         li.setAttribute('aria-label', `Ver ${item.description}`);

         const open = () => this.openDetail(item.id);
         li.addEventListener('click', open);
         li.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
               event.preventDefault();
               open();
            }
         });

         const dir = document.createElement('span');
         dir.className = 'payment-method-ledger__dir';
         dir.textContent = isPay ? 'Salida' : 'Entrada';

         const body = document.createElement('div');
         body.className = 'payment-method-ledger__body';

         const title = document.createElement('span');
         title.className = 'payment-method-ledger__item-title';
         title.textContent = item.description;

         const meta = document.createElement('span');
         meta.className = 'payment-method-ledger__item-meta';
         const bits = [];
         if (this.isAll()) {
            const name =
               this.paymentMethodService?.getById?.(item.accountId)?.name ?? 'Sin método';
            bits.push(name);
         }
         bits.push(settled ? (isPay ? 'Pagado' : 'Cobrado') : 'Pendiente');
         bits.push(this.formatDate(item.settledAt || item.dueDate || item.createdAt));
         meta.textContent = bits.join(' · ');

         body.append(title, meta);

         const amount = document.createElement('span');
         amount.className = 'payment-method-ledger__item-amount';
         amount.textContent = `${isPay ? '−' : '+'}${this.formatMoney(item.amount)}`;

         li.append(dir, body, amount);
         this.$list.appendChild(li);
      }
   }
}

customElements.define('slice-payment-method-ledger-panel', PaymentMethodLedgerPanel);
