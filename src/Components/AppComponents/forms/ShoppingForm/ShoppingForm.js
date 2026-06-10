import { SHOPPING_FREQUENCY } from '/Components/Service/ShoppingService/ShoppingService.js';

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

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });

      if (this.shoppingId) {
         this.loadItem(this.shoppingId);
      }
   }

   loadItem(shoppingId) {
      const item = this.shoppingService?.getById(shoppingId);
      if (!item) {
         return;
      }

      this.$nameInput.value = item.name;
      this.$frequencySelect.value = item.frequency ?? SHOPPING_FREQUENCY.WEEKLY;
   }

   async handleSubmit() {
      if (this._submitting || !this.shoppingService) {
         return;
      }

      const payload = {
         frequency: this.$frequencySelect.value,
         name: this.$nameInput.value
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
