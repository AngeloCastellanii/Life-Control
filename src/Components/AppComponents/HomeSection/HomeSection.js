export default class HomeSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$formActions = this.querySelector('[data-role="form-actions"]');
      this.$domainSelect = this.querySelector('#task-domain');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');
      if (!this.taskService || !this.domainService) {
         slice.logger.logError('HomeSection', 'Servicios no disponibles');
         return;
      }

      const submitBtn = await slice.build('Button', {
         value: 'Añadir tarea',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$formActions.appendChild(submitBtn);

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });

      slice.context.watch(
         'lifeControl',
         this,
         () => {
            this.renderDomainOptions();
            this.renderTasks();
         },
         (state) => ({ tasks: state?.tasks ?? [], domains: state?.domains ?? [] })
      );

      this.renderDomainOptions();
      this.renderTasks();
   }

   renderDomainOptions() {
      const domains = this.domainService.getAll();
      const current = this.$domainSelect.value;

      this.$domainSelect.innerHTML = '';
      if (domains.length === 0) {
         const option = document.createElement('option');
         option.value = '';
         option.textContent = 'Sin dominios — ve a Dominios';
         this.$domainSelect.appendChild(option);
         this.$domainSelect.disabled = true;
         return;
      }

      this.$domainSelect.disabled = false;
      for (const domain of domains) {
         const option = document.createElement('option');
         option.value = domain.id;
         option.textContent = domain.name;
         this.$domainSelect.appendChild(option);
      }

      if (current && domains.some((d) => d.id === current)) {
         this.$domainSelect.value = current;
      }
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }
      this._submitting = true;
      try {
         const title = this.querySelector('#task-title').value;
         const domainId = this.$domainSelect.value;
         const urgency = this.querySelector('#task-urgency').value;
         const minutes = this.querySelector('#task-minutes').value;

         if (!domainId) {
            return;
         }

         const created = await this.taskService.create({ title, domainId, urgency, minutes });
         if (!created) {
            return;
         }

         this.querySelector('#task-title').value = '';
         this.querySelector('#task-minutes').value = '30';
      } finally {
         this._submitting = false;
      }
   }

   domainColorFor(domainId) {
      const domain = this.domainService.getAll().find((d) => d.id === domainId);
      return domain?.color ?? '#71717a';
   }

   async renderTasks() {
      slice.controller.destroyByContainer(this.$tasks);
      this.$tasks.innerHTML = '';

      const tasks = this.taskService.getAll();
      const domains = this.domainService.getAll();
      const canAdd = domains.length > 0;
      this.$empty.hidden = canAdd && tasks.length > 0;

      if (!canAdd) {
         this.$empty.textContent = 'Crea un dominio en Dominios y luego añade tareas aquí.';
         this.$empty.hidden = false;
         return;
      }

      if (tasks.length === 0) {
         this.$empty.textContent = 'Sin tareas en el inbox.';
         this.$empty.hidden = false;
         return;
      }

      for (const task of tasks) {
         const card = await slice.build('TaskCard', {
            sliceId: `task-card-${task.id}`,
            task,
            domainColor: this.domainColorFor(task.domainId),
            draggable: true,
            onToggleComplete: (completed) => this.taskService.toggleComplete(task.id, completed)
         });
         this.$tasks.appendChild(card);
      }
   }
}

customElements.define('slice-home-section', HomeSection);
