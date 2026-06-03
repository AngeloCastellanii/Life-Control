export default class TaskForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'task-form' },
      taskId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$domainSelect = this.querySelector('#task-form-domain');
      this.$hint = this.querySelector('[data-role="hint"]');
      this.$titleInput = this.querySelector('#task-form-title');
      this.$urgencySelect = this.querySelector('#task-form-urgency');
      this.$minutesInput = this.querySelector('#task-form-minutes');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');

      const cancelBtn = await slice.build('Button', {
         value: 'Cancelar',
         variant: 'outlined',
         onClick: () => slice.events.emit('ui:modal:close')
      });
      const submitBtn = await slice.build('Button', {
         value: this.taskId ? 'Guardar cambios' : 'Guardar',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$actions.append(cancelBtn, submitBtn);

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });

      this.fillDomains();
      if (this.taskId) {
         this.loadTask(this.taskId);
      }
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

   loadTask(taskId) {
      const task = this.taskService?.getById(taskId);
      if (!task) {
         return;
      }

      this.$titleInput.value = task.title;
      this.$urgencySelect.value = task.urgency ?? 'medium';
      this.$minutesInput.value = String(task.minutes ?? 30);
      this.$domainSelect.value = task.domainId;
   }

   async handleSubmit() {
      this.taskService = slice.getComponent('task-service');
      if (this._submitting || !this.taskService) {
         return;
      }

      const domainId = this.$domainSelect.value;
      if (!domainId) {
         return;
      }

      const payload = {
         title: this.$titleInput.value,
         domainId,
         urgency: this.$urgencySelect.value,
         minutes: this.$minutesInput.value
      };

      this._submitting = true;
      try {
         const saved = this.taskId
            ? await this.taskService.update(this.taskId, payload)
            : await this.taskService.create(payload);

         if (saved) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-task-form', TaskForm);
