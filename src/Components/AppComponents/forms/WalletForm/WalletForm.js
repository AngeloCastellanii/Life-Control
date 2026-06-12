import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

export default class WalletForm extends HTMLElement {
   static props = {};

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$balanceInput = this.querySelector('#wallet-form-balance');
      this.$error = this.querySelector('[data-role="error"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      await buildModalButtons(this, { submitLabel: 'Guardar saldo' });
      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });
      this.populate();
   }

   async update() {
      await buildModalButtons(this, { submitLabel: 'Guardar saldo' });
      this.populate();
   }

   populate() {
      const balance = slice.context.getState('lifeControl')?.walletBalance ?? 0;
      this.$balanceInput.value = Number(balance).toFixed(2);
      hideFormError(this.$error);
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const financeService = getService('finance-service', ['setWalletBalance']);
      if (!financeService) {
         showFormError(this.$error, 'Servicio de finanzas no disponible. Recarga la página.');
         return;
      }

      const value = Number(String(this.$balanceInput.value).replace(',', '.'));
      if (!Number.isFinite(value) || value < 0) {
         showFormError(this.$error, 'Ingresa un monto válido (0 o más).');
         return;
      }

      this._submitting = true;
      hideFormError(this.$error);
      try {
         await financeService.setWalletBalance(value);
         closeModal();
      } catch (error) {
         console.error('WalletForm submit error:', error);
         showFormError(this.$error, 'No se pudo guardar el saldo. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-wallet-form', WalletForm);
