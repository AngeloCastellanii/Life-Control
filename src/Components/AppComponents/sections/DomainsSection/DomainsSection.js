export default class DomainsSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'domains-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$list = this.querySelector('[data-role="list"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.domainService = slice.getComponent('domain-service');
      this.taskService = slice.getComponent('task-service');
      if (!this.domainService) {
         slice.logger.logError('DomainsSection', 'DomainService no disponible');
         return;
      }

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderList(),
         (state) => ({
            domains: state?.domains ?? [],
            tasks: state?.tasks ?? []
         })
      );

      this.renderList();
   }

   openEdit(domainId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar dominio',
         form: 'DomainForm',
         domainId
      });
   }

   pendingCountFor(domainId, tasks) {
      return tasks.filter((task) => task.domainId === domainId && !task.completed).length;
   }

   async renderList() {
      const list = this.domainService.getAll();
      const tasks = this.taskService?.getAll?.() ?? [];
      this.$list.innerHTML = '';

      const hasItems = list.length > 0;
      this.$empty.hidden = hasItems;

      for (const domain of list) {
         const pending = this.pendingCountFor(domain.id, tasks);
         const item = document.createElement('li');
         item.className = 'domains-section__item';

         const meta = document.createElement('div');
         meta.className = 'domains-section__meta';

         const swatch = document.createElement('span');
         swatch.className = 'domains-section__swatch';
         swatch.style.backgroundColor = domain.color;

         const textWrap = document.createElement('div');
         textWrap.className = 'domains-section__text';

         const name = document.createElement('span');
         name.className = 'domains-section__name';
         name.textContent = domain.name;

         const stats = document.createElement('span');
         stats.className = 'domains-section__stats';
         stats.textContent = `${pending} tarea${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}`;

         textWrap.append(name, stats);
         meta.append(swatch, textWrap);
         item.appendChild(meta);

         const actions = document.createElement('div');
         actions.className = 'domains-section__actions';

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'domains-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.addEventListener('click', () => this.openEdit(domain.id));
         actions.appendChild(editBtn);

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'domains-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', async () => {
            const ok = await this.domainService.remove(domain.id);
            if (!ok) {
               window.alert('Debe existir al menos un dominio. Las tareas se reasignan al eliminar uno.');
            }
         });
         actions.appendChild(deleteBtn);

         item.appendChild(actions);
         this.$list.appendChild(item);
      }
   }
}

customElements.define('slice-domains-section', DomainsSection);
