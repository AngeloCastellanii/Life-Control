export default class PlannerSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'planner-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$blocks = this.querySelector('[data-role="blocks"]');
      this.$blocksEmpty = this.querySelector('[data-role="blocks-empty"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$addBlock = this.querySelector('[data-role="add-block"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.domainService = slice.getComponent('domain-service');
      this.timeBlockService = slice.getComponent('time-block-service');
      if (!this.taskService || !this.domainService || !this.timeBlockService) {
         return;
      }

      this.$addBlock.addEventListener('click', () => {
         slice.events.emit('ui:modal:open', {
            title: 'Configurar Contenedor de Tiempo',
            form: 'BlockForm'
         });
      });

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderAll(),
         (state) => ({
            tasks: state?.tasks ?? [],
            domains: state?.domains ?? [],
            timeBlocks: state?.timeBlocks ?? []
         })
      );

      slice.events.subscribe('time-block:changed', () => this.renderAll());
      slice.events.subscribe('task:changed', () => this.renderAll());

      this.renderAll();
   }

   openTaskEdit(taskId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar tarea',
         form: 'TaskForm',
         taskId
      });
   }

   async deleteTask(taskId) {
      if (window.confirm('¿Eliminar esta tarea?')) {
         await this.taskService.remove(taskId);
      }
   }

   taskCardActions(task) {
      return {
         onToggleComplete: (completed) => this.taskService.toggleComplete(task.id, completed),
         onEdit: () => this.openTaskEdit(task.id),
         onDelete: () => this.deleteTask(task.id)
      };
   }

   domainColorFor(domainId) {
      const domain = this.domainService.getAll().find((d) => d.id === domainId);
      return domain?.color ?? '#71717a';
   }

   _destroyByPrefix(prefix) {
      const ids = [...slice.controller.activeComponents.keys()].filter((id) => id.startsWith(prefix));
      if (ids.length) {
         slice.controller.destroyComponent(ids);
      }
   }

   async renderAll() {
      await this.renderBlocks();
      await this.renderInbox();
   }

   async renderBlocks() {
      this._destroyByPrefix('planner-block-');
      this._destroyByPrefix('task-card-block-');
      this.$blocks.innerHTML = '';

      this.timeBlockService = slice.getComponent('time-block-service');
      if (!this.timeBlockService) {
         return;
      }

      const blocks = this.timeBlockService.getAll();
      this.$blocksEmpty.hidden = blocks.length > 0;

      for (const block of blocks) {
         const usedMinutes = this.timeBlockService.usedMinutes(block.id);
         const blockEl = await slice.build('TimeBlock', {
            sliceId: `planner-block-${block.id}`,
            block,
            usedMinutes,
            onRemove: (id) => this.timeBlockService.remove(id),
            onEdit: (id) => {
               slice.events.emit('ui:modal:open', {
                  title: 'Configurar Contenedor de Tiempo',
                  form: 'BlockForm',
                  blockId: id
               });
            },
            onDropTask: (taskId, blockId) => this.timeBlockService.assignTask(blockId, taskId)
         });

         if (!blockEl) {
            continue;
         }

         const tasksHost = blockEl.querySelector('[data-role="tasks"]');
         const blockTasks = this.taskService.getAll().filter((t) => t.blockId === block.id);

         for (const task of blockTasks) {
            const card = await slice.build('TaskCard', {
               sliceId: `task-card-block-${block.id}-${task.id}`,
               task,
               domainColor: this.domainColorFor(task.domainId),
               draggable: false,
               ...this.taskCardActions(task),
               onRemoveFromBlock: () => this.timeBlockService.unassignTask(block.id, task.id)
            });
            if (card) {
               tasksHost.appendChild(card);
            }
         }

         if (blockTasks.length > 0) {
            const hint = blockEl.querySelector('.time-block__hint');
            if (hint) {
               hint.hidden = true;
            }
         }

         this.$blocks.appendChild(blockEl);
      }
   }

   async renderInbox() {
      if (this._renderingInbox) {
         return;
      }
      this._renderingInbox = true;
      try {
         this._destroyByPrefix(this._taskCardPrefix());
         this.$tasks.innerHTML = '';

         const tasks = this.taskService.getAll().filter((t) => !t.blockId);
         const domains = this.domainService.getAll();

         if (domains.length === 0) {
            this.$empty.textContent = 'Crea un dominio en Dominios primero.';
            this.$empty.hidden = false;
            return;
         }

         if (tasks.length === 0) {
            this.$empty.textContent = 'Sin tareas en el inbox. Pulsa +.';
            this.$empty.hidden = false;
            return;
         }

         this.$empty.hidden = true;

         for (const task of tasks) {
            const card = await slice.build('TaskCard', {
               sliceId: `${this._taskCardPrefix()}${task.id}`,
               task,
               domainColor: this.domainColorFor(task.domainId),
               draggable: true,
               ...this.taskCardActions(task)
            });
            if (card) {
               this.$tasks.appendChild(card);
            }
         }
      } finally {
         this._renderingInbox = false;
      }
   }

   _taskCardPrefix() {
      return `task-card-${this.sliceId}-`;
   }
}

customElements.define('slice-planner-section', PlannerSection);
