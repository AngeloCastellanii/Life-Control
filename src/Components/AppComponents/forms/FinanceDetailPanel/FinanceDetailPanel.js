import { FINANCE_TYPE } from '../../sections/lifeControlConstants.js';

const TYPE_LABELS = {
   [FINANCE_TYPE.PAY]: 'Egreso / por pagar',
   [FINANCE_TYPE.RECEIVE]: 'Ingreso / por cobrar'
};

export default class FinanceDetailPanel extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'finance-detail-panel' },
      financeId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$title = this.querySelector('[data-role="title"]');
      this.$status = this.querySelector('[data-role="status"]');
      this.$type = this.querySelector('[data-role="type"]');
      this.$amount = this.querySelector('[data-role="amount"]');
      this.$account = this.querySelector('[data-role="account"]');
      this.$due = this.querySelector('[data-role="due"]');
      this.$settled = this.querySelector('[data-role="settled"]');
      this.$settledAtRow = this.querySelector('[data-role="settled-at-row"]');
      this.$settledAt = this.querySelector('[data-role="settled-at"]');
      this.$created = this.querySelector('[data-role="created"]');
      this.$toggleSettled = this.querySelector('[data-role="toggle-settled"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.financeService = slice.getComponent('finance-service');

      this.$toggleSettled.addEventListener('click', () => this.toggleSettled());
      this.$edit.addEventListener('click', () => this.openEdit());

      slice.context.watch(
         'lifeControl',
         this,
         () => this.paint(),
         (state) => ({ finances: state?.finances ?? [] })
      );

      this.paint();
   }

   item() {
      return this.financeService?.getById?.(this.financeId) ?? null;
   }

   formatMoney(value) {
      return `$${(Number(value) || 0).toFixed(2)}`;
   }

   formatDate(iso) {
      if (!iso) {
         return '—';
      }
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
   }

   formatDateTime(iso) {
      if (!iso) {
         return '—';
      }
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
         return this.formatDate(iso);
      }
      return date.toLocaleDateString('es-ES', {
         day: 'numeric',
         month: 'long',
         year: 'numeric'
      });
   }

   openEdit() {
      const item = this.item();
      if (!item) {
         return;
      }
      slice.events.emit('ui:modal:open', {
         title: 'Editar transacción',
         form: 'FinanceForm',
         financeId: item.id
      });
   }

   async toggleSettled() {
      const item = this.item();
      if (!item) {
         return;
      }
      await this.financeService?.toggleSettled?.(item.id, !item.settled);
   }

   paint() {
      const item = this.item();
      if (!item) {
         this.$title.textContent = 'Transacción no encontrada';
         this.$status.textContent = '';
         this.$toggleSettled.hidden = true;
         this.$edit.hidden = true;
         return;
      }

      const isPay = item.type === FINANCE_TYPE.PAY;
      const settled = !!item.settled;

      this.$title.textContent = item.description;
      this.$status.textContent = settled ? (isPay ? 'Pagada' : 'Cobrada') : 'Pendiente';
      this.$status.className = `finance-detail-panel__status finance-detail-panel__status--${settled ? 'done' : 'pending'}`;

      this.$type.textContent = TYPE_LABELS[item.type] ?? item.type;
      this.$amount.textContent = this.formatMoney(item.amount);
      this.$amount.className = `finance-detail-panel__amount finance-detail-panel__amount--${isPay ? 'pay' : 'receive'}`;
      const methodName =
         slice.getComponent('payment-method-service')?.getById?.(item.accountId)?.name ?? '—';
      if (this.$account) {
         this.$account.textContent = methodName;
      }
      this.$due.textContent = this.formatDate(item.dueDate);
      this.$settled.textContent = settled ? (isPay ? 'Pagado' : 'Cobrado') : 'Pendiente';
      this.$settledAtRow.hidden = !settled;
      this.$settledAt.textContent = this.formatDate(item.settledAt ?? item.dueDate);
      this.$created.textContent = this.formatDateTime(item.createdAt);

      this.$toggleSettled.hidden = false;
      this.$toggleSettled.textContent = settled
         ? isPay
            ? 'Marcar como pendiente de pago'
            : 'Marcar como pendiente de cobro'
         : isPay
           ? 'Marcar como pagada'
           : 'Marcar como cobrada';

      this.$edit.hidden = false;
   }
}

customElements.define('slice-finance-detail-panel', FinanceDetailPanel);
