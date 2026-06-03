export default class TaskForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'task-form' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$domainSelect = this.querySelector('#task-form-domain');
      this.$hint = this.querySelector('[data-role="hint"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
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

      this.fillDomains();
   }

   fillDomains() {
      const domains = this.domainService?.getAll() ?? [];
      this.$domainSelect.innerHTML = '';

      if (domains.length === 0) {
         this.$hint.hidden = false;
         this.$domainSelect.disabled = true;
         return;
      }

      this.$hint.hidden = true;
      this.$domainSelect.disabled = false;
      for (const domain of domains) {
         const option = document.createElement('option');
         option.value = domain.id;
         option.textContent = domain.name;
         this.$domainSelect.appendChild(option);
      }
   }

   async handleSubmit() {
      if (this._submitting || !this.taskService) {
         return;
      }
      const domainId = this.$domainSelect.value;
      if (!domainId) {
         return;
      }

      this._submitting = true;
      try {
         const created = await this.taskService.create({
            title: this.querySelector('#task-form-title').value,
            domainId,
            urgency: this.querySelector('#task-form-urgency').value,
            minutes: this.querySelector('#task-form-minutes').value
         });
         if (created) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-task-form', TaskForm);
