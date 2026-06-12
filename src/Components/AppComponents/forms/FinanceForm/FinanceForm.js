import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

export default class FinanceForm extends HTMLElement {
   static props = {};

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$typeSelect = this.querySelector('#finance-form-type');
      this.$descriptionInput = this.querySelector('#finance-form-description');
      this.$amountInput = this.querySelector('#finance-form-amount');
      this.$dueInput = this.querySelector('#finance-form-due');
      this.$error = this.querySelector('[data-role="error"]');
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      await this.ensureButtons();
      this.bindForm();
      hideFormError(this.$error);
   }

   async update() {
      await this.ensureButtons();
      hideFormError(this.$error);
   }

   async ensureButtons() {
      if (this._buttonsReady && this.$actions.childElementCount >= 2) {
         return;
      }
      await buildModalButtons(this, { submitLabel: 'Guardar' });
      this._buttonsReady = true;
   }

   bindForm() {
      if (this._formBound) {
         return;
      }
      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });
      this._formBound = true;
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const financeService = getService('finance-service', ['create']);
      if (!financeService) {
         showFormError(this.$error, 'Servicio de finanzas no disponible. Recarga la página.');
         return;
      }

      const description = this.$descriptionInput.value.trim();
      const amount = Number(String(this.$amountInput.value).replace(',', '.'));
      if (!description) {
         showFormError(this.$error, 'Ingresa una descripción.');
         return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
         showFormError(this.$error, 'Ingresa un monto válido mayor a 0.');
         return;
      }

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const created = await financeService.create({
            type: this.$typeSelect.value,
            description,
            amount,
            dueDate: this.$dueInput.value || null
         });

         if (created) {
            closeModal();
            return;
         }

         showFormError(this.$error, 'No se pudo guardar la transacción. Intenta de nuevo.');
      } catch (error) {
         console.error('FinanceForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-finance-form', FinanceForm);
