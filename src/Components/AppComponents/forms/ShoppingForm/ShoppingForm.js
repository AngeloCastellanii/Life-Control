import {
   SHOPPING_FREQUENCY,
   addPeriod,
   todayISO
} from '../../../Service/ShoppingService/ShoppingService.js';

export default class ShoppingForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'shopping-form' },
      shoppingId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$frequencySelect = this.querySelector('#shopping-form-frequency');
      this.$nameInput = this.querySelector('#shopping-form-name');
      this.$lastDoneInput = this.querySelector('#shopping-form-last-done');
      this.$nextDueInput = this.querySelector('#shopping-form-next-due');
      this.$nextHint = this.querySelector('[data-role="next-hint"]');
      this._nextDueTouched = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.shoppingService = slice.getComponent('shopping-service');

      const cancelBtn = await slice.build('Button', {
         value: 'Cancelar',
         variant: 'outlined',
         onClick: () => slice.events.emit('ui:modal:close')
      });
      const submitBtn = await slice.build('Button', {
         value: this.shoppingId ? 'Guardar cambios' : 'Guardar',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$actions.append(cancelBtn, submitBtn);

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

      if (this.shoppingId) {
         this.loadItem(this.shoppingId);
      } else {
         this.$nextDueInput.value = todayISO();
      }
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
      const item = this.shoppingService?.getById(shoppingId);
      if (!item) {
         return;
      }

      this.$nameInput.value = item.name;
      this.$frequencySelect.value = item.frequency ?? SHOPPING_FREQUENCY.WEEKLY;
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
      if (this._submitting || !this.shoppingService) {
         return;
      }

      const payload = {
         frequency: this.$frequencySelect.value,
         name: this.$nameInput.value,
         lastDoneAt: this.$lastDoneInput.value || null,
         nextDueAt: this.$nextDueInput.value || null
      };

      this._submitting = true;
      try {
         const saved = this.shoppingId
            ? await this.shoppingService.update(this.shoppingId, payload)
            : await this.shoppingService.create(payload);

         if (saved) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-shopping-form', ShoppingForm);
