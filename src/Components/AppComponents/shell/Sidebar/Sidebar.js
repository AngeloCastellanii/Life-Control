export default class Sidebar extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'app-sidebar' },
      items: { type: 'array', default: [] }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$list = this.querySelector('[data-role="list"]');
      this.$footer = this.querySelector('[data-role="footer"]');
      this._linkItems = [];
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      await this.renderItems();
      this.renderSearchButton();
      this.syncActivePath();

      slice.events.subscribe('router:change', () => this.syncActivePath());
   }

   renderSearchButton() {
      if (!this.$footer || this.$footer.querySelector('.sidebar__search')) {
         return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sidebar__search';
      button.setAttribute('aria-label', 'Buscar');
      button.innerHTML =
         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg><span>Buscar</span>';
      button.addEventListener('click', () => {
         slice.events.emit('ui:modal:open', { title: 'Buscar', form: 'SearchPanel' });
      });
      this.$footer.appendChild(button);
   }

   async renderItems() {
      this.$list.innerHTML = '';
      this._linkItems = [];

      for (const item of this.items ?? []) {
         const li = document.createElement('li');
         li.className = 'sidebar__item';
         li.dataset.path = item.path;

         const link = await slice.build('Link', {
            text: item.text,
            path: item.path,
            classes: 'sidebar__link'
         });
         li.appendChild(link);
         this.$list.appendChild(li);
         this._linkItems.push(li);
      }
   }

   syncActivePath() {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';

      for (const li of this._linkItems) {
         const itemPath = (li.dataset.path || '/').replace(/\/+$/, '') || '/';
         const isActive =
            path === itemPath || (itemPath !== '/' && path.startsWith(`${itemPath}/`));
         li.classList.toggle('sidebar__item--active', isActive);
      }
   }
}

customElements.define('slice-sidebar', Sidebar);
