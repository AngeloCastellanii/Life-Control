import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

export default class DomainForm extends HTMLElement {
   static props = {
      domainId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$nameInput = this.querySelector('#domain-form-name');
      this.$colorInput = this.querySelector('#domain-form-color');
      this.$budgetInput = this.querySelector('#domain-form-budget');
      this.$error = this.querySelector('[data-role="error"]');
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
         submitLabel: this.domainId ? 'Guardar cambios' : 'Guardar'
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
      if (this.domainId) {
         this.loadDomain(this.domainId);
      }
   }

   loadDomain(domainId) {
      const domainService = getService('domain-service', ['getAll']);
      const domain = domainService?.getAll().find((item) => item.id === domainId);
      if (!domain) {
         showFormError(this.$error, 'No se encontró el dominio.');
         return;
      }

      this.$nameInput.value = domain.name;
      this.$colorInput.value = domain.color || '#2563eb';
      this.$budgetInput.value = domain.monthlyBudget ? String(domain.monthlyBudget) : '';
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const domainService = getService('domain-service', ['create', 'update']);
      if (!domainService) {
         showFormError(this.$error, 'Servicio de dominios no disponible. Recarga la página.');
         return;
      }

      const name = this.$nameInput.value.trim();
      if (!name) {
         showFormError(this.$error, 'Ingresa un nombre para el dominio.');
         return;
      }

      const payload = {
         name,
         color: this.$colorInput.value,
         monthlyBudget: Number(this.$budgetInput.value) || 0
      };

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = this.domainId
            ? await domainService.update(this.domainId, payload)
            : await domainService.create(payload);

         if (saved) {
            closeModal();
            return;
         }

         showFormError(this.$error, 'No se pudo guardar el dominio.');
      } catch (error) {
         console.error('DomainForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-domain-form', DomainForm);
