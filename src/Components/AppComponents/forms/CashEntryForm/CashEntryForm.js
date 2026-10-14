import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

function todayISO() {
   return new Date().toISOString().slice(0, 10);
}

export default class CashEntryForm extends HTMLElement {
   static props = {
      entryType: { type: 'string', default: 'pay' },
      paymentMethodId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$hint = this.querySelector('[data-role="hint"]');
      this.$amount = this.querySelector('#cash-entry-amount');
      this.$date = this.querySelector('#cash-entry-date');
      this.$account = this.querySelector('#cash-entry-account');
      this.$name = this.querySelector('#cash-entry-name');
      this.$note = this.querySelector('#cash-entry-note');
      this.$error = this.querySelector('[data-role="error"]');
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
   }

   incoming() {
      return this.entryType === 'receive';
   }

   async init() {
      await this.ensureButtons();
      this.bindForm();
      this.populate();
   }

   async update() {
      await this.ensureButtons();
      this.populate();
   }

   populate() {
      hideFormError(this.$error);
      const incoming = this.incoming();
      if (this.$hint) {
         this.$hint.textContent = incoming
            ? 'Suma esta cantidad al método ahora.'
            : 'Resta esta cantidad del método ahora.';
      }
      if (this.$name) {
         this.$name.placeholder = incoming ? 'Sueldo, transferencia…' : 'Supermercado, alquiler…';
      }
      if (this.$date && !this.$date.value) {
         this.$date.value = todayISO();
      }
      this.fillAccounts();
   }

   fillAccounts() {
      const methods = getService('payment-method-service', ['getAll'])?.getAll() ?? [];
      this.$account.innerHTML = '';
      if (methods.length === 0) {
         const option = document.createElement('option');
         option.value = '';
         option.textContent = 'Sin métodos';
         this.$account.appendChild(option);
         this.$account.disabled = true;
         return;
      }
      this.$account.disabled = false;
      for (const method of methods) {
         const option = document.createElement('option');
         option.value = method.id;
         option.textContent = method.name;
         this.$account.appendChild(option);
      }
      const preferred = this.paymentMethodId;
      if (preferred && methods.some((method) => method.id === preferred)) {
         this.$account.value = preferred;
      }
   }

   async ensureButtons() {
      if (this._buttonsReady && this.$actions.childElementCount >= 2) {
         return;
      }
      await buildModalButtons(this, {
         submitLabel: this.incoming() ? 'Registrar' : 'Descontar'
      });
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
      const financeService = getService('finance-service', ['recordCash']);
      if (!financeService) {
         showFormError(this.$error, 'Finanzas no está disponible. Recarga la página.');
         return;
      }

      const description = this.$name.value.trim();
      const amount = Number(String(this.$amount.value).replace(',', '.'));
      const accountId = this.$account.value;
      if (!description) {
         showFormError(this.$error, 'Escribe el nombre de lo que pagaste o recibiste.');
         return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
         showFormError(this.$error, 'Escribe una cantidad mayor a 0.');
         return;
      }
      if (!this.$date.value) {
         showFormError(this.$error, 'Elige la fecha.');
         return;
      }
      if (!accountId) {
         showFormError(this.$error, 'Elige un método de pago.');
         return;
      }

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = await financeService.recordCash({
            description,
            amount,
            type: this.incoming() ? 'receive' : 'pay',
            date: this.$date.value,
            accountId,
            note: this.$note.value
         });
         if (!saved) {
            showFormError(this.$error, 'No se pudo guardar. Revisa los datos.');
            return;
         }
         closeModal();
      } catch (error) {
         console.error('CashEntryForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-cash-entry-form', CashEntryForm);
