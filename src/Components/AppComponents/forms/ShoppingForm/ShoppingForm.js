import {
   SHOPPING_FREQUENCY,
   addPeriod,
   todayISO
} from '../../../Service/ShoppingService/ShoppingService.js';
import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

function parsePrice(raw) {
   if (raw === '' || raw == null) {
      return null;
   }
   const value = Number(raw);
   if (!Number.isFinite(value) || value < 0) {
      return null;
   }
   return Math.round(value * 100) / 100;
}

export default class ShoppingForm extends HTMLElement {
   static props = {
      shoppingId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$frequencySelect = this.querySelector('#shopping-form-frequency');
      this.$nameInput = this.querySelector('#shopping-form-name');
      this.$priceInput = this.querySelector('#shopping-form-price');
      this.$accountSelect = this.querySelector('#shopping-form-account');
      this.$lastDoneInput = this.querySelector('#shopping-form-last-done');
      this.$nextDueInput = this.querySelector('#shopping-form-next-due');
      this.$nextHint = this.querySelector('[data-role="next-hint"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._nextDueTouched = false;
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
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

   async ensureButtons() {
      if (this._buttonsReady && this.$actions.childElementCount >= 2) {
         return;
      }
      await buildModalButtons(this, {
         submitLabel: this.shoppingId ? 'Guardar cambios' : 'Guardar'
      });
      this._buttonsReady = true;
   }

   bindForm() {
      if (this._formBound) {
         return;
      }

      this.$frequencySelect.addEventListener('change', () => this.syncNextDueFromLast());
      this.$lastDoneInput.addEventListener('change', () => {
         this._nextDueTouched = false;
         this.syncNextDueFromLast();
      });
      this.$nextDueInput.addEventListener('input', () => {
         this._nextDueTouched = true;
      });
      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });
      this._formBound = true;
   }

   populateAccounts(selectedId = null) {
      if (!this.$accountSelect) {
         return;
      }
      const pm = getService('payment-method-service', ['getAll']);
      const methods = pm?.getAll?.() ?? [];
      this.$accountSelect.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = methods.length ? 'Método por defecto' : 'Sin métodos (usa el fondo)';
      this.$accountSelect.appendChild(empty);
      for (const method of methods) {
         const option = document.createElement('option');
         option.value = method.id;
         option.textContent = method.name;
         this.$accountSelect.appendChild(option);
      }
      if (selectedId && methods.some((m) => m.id === selectedId)) {
         this.$accountSelect.value = selectedId;
      }
   }

   populate() {
      hideFormError(this.$error);
      this.populateAccounts();
      if (this.shoppingId) {
         this.loadItem(this.shoppingId);
         return;
      }
      this.$priceInput.value = '';
      this.$nextDueInput.value = todayISO();
   }

   syncNextDueFromLast() {
      const last = this.$lastDoneInput.value;
      if (!last) {
         return;
      }

      const frequency = this.$frequencySelect.value;
      const next = addPeriod(last, frequency);
      const currentNext = this.$nextDueInput.value;

      if (!this._nextDueTouched || !currentNext || currentNext <= last) {
         this.$nextDueInput.value = next;
         this.$nextHint.textContent = `Calculada según frecuencia: ${next}`;
      }
   }

   loadItem(shoppingId) {
      const shoppingService = getService('shopping-service', ['getById']);
      const item = shoppingService?.getById(shoppingId);
      if (!item) {
         showFormError(this.$error, 'No se encontró el artículo.');
         return;
      }

      this.$nameInput.value = item.name;
      this.$frequencySelect.value = item.frequency ?? SHOPPING_FREQUENCY.WEEKLY;
      this.$priceInput.value =
         item.price != null && Number(item.price) > 0 ? String(item.price) : '';
      this.populateAccounts(item.accountId ?? null);
      this.$lastDoneInput.value = item.lastDoneAt ?? '';
      const frequency = item.frequency ?? SHOPPING_FREQUENCY.WEEKLY;
      const nextDue =
         item.lastDoneAt && item.nextDueAt && item.nextDueAt <= item.lastDoneAt
            ? addPeriod(item.lastDoneAt, frequency)
            : (item.nextDueAt ?? todayISO());
      this.$nextDueInput.value = nextDue;
      this._nextDueTouched = Boolean(item.nextDueAt && item.nextDueAt > (item.lastDoneAt ?? ''));
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const shoppingService = getService('shopping-service', ['create', 'update']);
      if (!shoppingService) {
         showFormError(this.$error, 'Servicio de compras no disponible. Recarga la página.');
         return;
      }

      const name = this.$nameInput.value.trim();
      if (!name) {
         showFormError(this.$error, 'Ingresa el nombre del artículo.');
         return;
      }

      const price = parsePrice(this.$priceInput.value);
      if (this.$priceInput.value !== '' && (price === null || price < 0)) {
         showFormError(this.$error, 'Ingresa un precio válido (0 o más).');
         return;
      }

      const payload = {
         frequency: this.$frequencySelect.value,
         name,
         price: price && price > 0 ? price : null,
         accountId: this.$accountSelect.value || null,
         lastDoneAt: this.$lastDoneInput.value || null,
         nextDueAt: this.$nextDueInput.value || null
      };

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = this.shoppingId
            ? await shoppingService.update(this.shoppingId, payload)
            : await shoppingService.create(payload);

         if (saved) {
            closeModal();
            return;
         }

         showFormError(this.$error, 'No se pudo guardar. Revisa los datos e intenta de nuevo.');
      } catch (error) {
         console.error('ShoppingForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-shopping-form', ShoppingForm);
