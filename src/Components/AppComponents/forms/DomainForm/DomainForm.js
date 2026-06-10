export default class DomainForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'domain-form' },
      domainId: { type: 'string', default: null }
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

      const cancelBtn = await slice.build('Button', {
         value: 'Cancelar',
         variant: 'outlined',
         onClick: () => slice.events.emit('ui:modal:close')
      });
      const submitBtn = await slice.build('Button', {
         value: this.domainId ? 'Guardar cambios' : 'Guardar',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$actions.append(cancelBtn, submitBtn);

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });

      if (this.domainId) {
         this.loadDomain(this.domainId);
      }
   }

   loadDomain(domainId) {
      const domain = this.domainService?.getAll().find((d) => d.id === domainId);
      if (!domain) {
         return;
      }

      this.$nameInput.value = domain.name;
      this.$colorInput.value = domain.color || '#2563eb';
   }

   async handleSubmit() {
      if (this._submitting || !this.domainService) {
         return;
      }

      const payload = {
         name: this.$nameInput.value,
         color: this.$colorInput.value
      };

      this._submitting = true;
      try {
         const saved = this.domainId
            ? await this.domainService.update(this.domainId, payload)
            : await this.domainService.create(payload);

         if (saved) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-domain-form', DomainForm);
