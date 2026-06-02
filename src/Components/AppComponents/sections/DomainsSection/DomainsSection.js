export default class DomainsSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'domains-section' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$list = this.querySelector('[data-role="list"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$formActions = this.querySelector('[data-role="form-actions"]');
      this.$nameInput = this.querySelector('#domain-name');
      this.$colorInput = this.querySelector('#domain-color');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.domainService = slice.getComponent('domain-service');
      if (!this.domainService) {
         slice.logger.logError('DomainsSection', 'DomainService no disponible');
         return;
      }
      this.events = slice.events.bind(this);

      this.submitBtn = await slice.build('Button', {
         value: 'Agregar dominio',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$formActions.appendChild(this.submitBtn);

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });

      slice.context.watch(
         'lifeControl',
         this,
         (domains) => this.renderList(domains),
         (state) => state?.domains ?? []
      );

      this.renderList(this.domainService.getAll());
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }
      this._submitting = true;
      try {
         await this._createDomain();
      } finally {
         this._submitting = false;
      }
   }

   async _createDomain() {
      const name = this.$nameInput.value;
      const color = this.$colorInput.value;
      const created = await this.domainService.create({ name, color });
      if (!created) {
         return;
      }
      this.$nameInput.value = '';
      this.$colorInput.value = '#2563eb';
   }

   async renderList(domains = this.domainService.getAll()) {
      slice.controller.destroyByContainer(this.$list);
      this.$list.innerHTML = '';

      const hasItems = domains.length > 0;
      this.$empty.hidden = hasItems;

      for (const domain of domains) {
         const item = document.createElement('li');
         item.className = 'domains-section__item';

         const meta = document.createElement('div');
         meta.className = 'domains-section__meta';

         const swatch = document.createElement('span');
         swatch.className = 'domains-section__swatch';
         swatch.style.backgroundColor = domain.color;

         const name = document.createElement('span');
         name.className = 'domains-section__name';
         name.textContent = domain.name;

         meta.appendChild(swatch);
         meta.appendChild(name);
         item.appendChild(meta);

         const deleteBtn = await slice.build('Button', {
            value: 'Eliminar',
            variant: 'outlined',
            onClick: () => this.domainService.remove(domain.id)
         });
         item.appendChild(deleteBtn);
         this.$list.appendChild(item);
      }
   }
}

customElements.define('slice-domains-section', DomainsSection);
