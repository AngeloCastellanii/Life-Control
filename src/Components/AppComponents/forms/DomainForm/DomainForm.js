export default class DomainForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'domain-form' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$nameInput = this.querySelector('#domain-form-name');
      this.$colorInput = this.querySelector('#domain-form-color');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.domainService = slice.getComponent('domain-service');

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
      if (this._submitting || !this.domainService) {
         return;
      }
      this._submitting = true;
      try {
         const created = await this.domainService.create({
            name: this.$nameInput.value,
            color: this.$colorInput.value
         });
         if (created) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-domain-form', DomainForm);
