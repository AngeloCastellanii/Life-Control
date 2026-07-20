import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';
import { PAYMENT_METHOD_COLORS } from '../../sections/paymentMethodColors.js';

export default class PaymentMethodForm extends HTMLElement {
   static props = {
      paymentMethodId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$name = this.querySelector('#payment-method-form-name');
      this.$balance = this.querySelector('#payment-method-form-balance');
      this.$balanceLabel = this.querySelector('[data-role="balance-label"]');
      this.$balanceHint = this.querySelector('[data-role="balance-hint"]');
      this.$pool = this.querySelector('[data-role="pool"]');
      this.$poolHint = this.querySelector('[data-role="pool-hint"]');
      this.$colors = this.querySelector('[data-role="colors"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._color = PAYMENT_METHOD_COLORS[0];
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.renderColors();
      await this.ensureButtons();
      this.bindForm();
      this.populate();
   }

   async update() {
      await this.ensureButtons();
      this.populate();
   }

   renderColors() {
      if (this.$colors.childElementCount > 0) {
         return;
      }
      for (const color of PAYMENT_METHOD_COLORS) {
         const swatch = document.createElement('button');
         swatch.type = 'button';
         swatch.className = 'payment-method-form__color';
         swatch.style.backgroundColor = color;
         swatch.dataset.color = color;
         swatch.addEventListener('click', () => this.selectColor(color));
         this.$colors.appendChild(swatch);
      }
   }

   selectColor(color) {
      this._color = color;
      for (const swatch of this.$colors.children) {
         swatch.classList.toggle('payment-method-form__color--active', swatch.dataset.color === color);
      }
   }

   async ensureButtons() {
      if (this._buttonsReady && this.$actions.childElementCount >= 2) {
         return;
      }
      await buildModalButtons(this, {
         submitLabel: this.paymentMethodId ? 'Guardar' : 'Añadir método'
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

   populate() {
      hideFormError(this.$error);
      const service = getService('payment-method-service', ['getById', 'getPool', 'getAll', 'getLegacyWalletBalance']);
      const pool = service?.getPool?.();
      const methods = service?.getAll?.() ?? [];

      if (this.paymentMethodId) {
         const method = service?.getById?.(this.paymentMethodId);
         if (!method) {
            showFormError(this.$error, 'No se encontró el método.');
            return;
         }
         this.$name.value = method.name;
         this.$balance.value = String(method.balance);
         this.$pool.checked = Boolean(method.isPool);
         this.selectColor(method.color || PAYMENT_METHOD_COLORS[0]);
         this.$balanceHint.textContent = method.isPool
            ? 'Fondo principal: al crear otros métodos se puede usar este saldo primero.'
            : pool
              ? `Si subes el saldo y hay dinero en “${pool.name}”, se usa primero ese fondo.`
              : 'Este saldo suma al total del fondo.';
      } else {
         this.$name.value = '';
         this.$pool.checked = false;
         this.selectColor(PAYMENT_METHOD_COLORS[0]);

         // Solo sugiere el saldo legado si aún no hay métodos (no inventa cuentas).
         const legacy =
            methods.length === 0 ? Number(service?.getLegacyWalletBalance?.() || 0) : 0;
         this.$balance.value = legacy > 0 ? String(legacy) : '0';
         this.$balanceHint.textContent = pool
            ? `Si “${pool.name}” tiene saldo, se usará primero. Si no, entra directo aquí.`
            : legacy > 0
              ? 'Aún no tienes métodos: este será el primero. Ajusta el monto si hace falta.'
              : 'Pon el saldo de este método. El total del fondo será la suma de todos.';
      }
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }
      const service = getService('payment-method-service', ['create', 'update']);
      if (!service) {
         showFormError(this.$error, 'Servicio no disponible.');
         return;
      }

      const name = this.$name.value.trim();
      const balance = Number(String(this.$balance.value).replace(',', '.'));
      const isPool = Boolean(this.$pool?.checked);
      if (!name) {
         showFormError(this.$error, 'Ingresa un nombre.');
         return;
      }
      if (!Number.isFinite(balance)) {
         showFormError(this.$error, 'Ingresa un saldo válido.');
         return;
      }

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const payload = { name, balance, color: this._color, isPool };
         const saved = this.paymentMethodId
            ? await service.update(this.paymentMethodId, payload)
            : await service.create(payload);
         if (saved) {
            closeModal();
            return;
         }
         showFormError(this.$error, 'No se pudo guardar.');
      } catch (error) {
         showFormError(this.$error, error.message || 'Error al guardar.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-payment-method-form', PaymentMethodForm);
