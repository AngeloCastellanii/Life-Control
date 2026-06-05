export default class HomeSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');
      if (!this.taskService || !this.domainService) {
         slice.logger.logError('HomeSection', 'Servicios no disponibles');
         return;
      }

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderTasks(),
         (state) => ({ tasks: state?.tasks ?? [], domains: state?.domains ?? [] })
      );

      this.renderTasks();
   }

   domainColorFor(domainId) {
      const domain = this.domainService.getAll().find((d) => d.id === domainId);
      return domain?.color ?? '#71717a';
   }

   _destroyTaskCards() {
      const ids = [];
      for (const sliceId of slice.controller.activeComponents.keys()) {
         if (!sliceId.startsWith('task-card-')) {
            continue;
         }
         const comp = slice.controller.getComponent(sliceId);
         if (comp && this.$tasks.contains(comp)) {
            ids.push(sliceId);
         }
      }
      if (ids.length) {
         slice.controller.destroyComponent(ids);
      }
   }

   async renderTasks() {
      this._destroyTaskCards();
      this.$tasks.innerHTML = '';

      const tasks = this.taskService.getAll();
      const domains = this.domainService.getAll();
      const canAdd = domains.length > 0;
      this.$empty.hidden = canAdd && tasks.length > 0;

      if (!canAdd) {
         this.$empty.textContent = 'Crea un dominio en Dominios y luego añade tareas con +.';
         this.$empty.hidden = false;
         return;
      }

      if (tasks.length === 0) {
         this.$empty.textContent = 'Sin tareas en el inbox. Pulsa + para agregar.';
         this.$empty.hidden = false;
         return;
      }

      for (const task of tasks) {
         const card = await slice.build('TaskCard', {
            sliceId: `task-card-${task.id}`,
            task,
            domainColor: this.domainColorFor(task.domainId),
            onToggleComplete: (completed) => this.taskService.toggleComplete(task.id, completed)
         });
         if (card) {
            this.$tasks.appendChild(card);
         }
      }
   }
}

customElements.define('slice-home-section', HomeSection);
