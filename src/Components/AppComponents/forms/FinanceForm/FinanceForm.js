export default class FinanceForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'finance-form' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$typeSelect = this.querySelector('#finance-form-type');
      this.$descriptionInput = this.querySelector('#finance-form-description');
      this.$amountInput = this.querySelector('#finance-form-amount');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.financeService = slice.getComponent('finance-service');

      const submitBtn = await slice.build('Button', {
         value: 'Guardar',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$actions.appendChild(submitBtn);

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });
   }

   async handleSubmit() {
      if (this._submitting || !this.financeService) {
         return;
      }

      this._submitting = true;
      try {
         const created = await this.financeService.create({
            type: this.$typeSelect.value,
            description: this.$descriptionInput.value,
            amount: this.$amountInput.value
         });
         if (created) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-finance-form', FinanceForm);
