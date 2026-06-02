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
      this.syncActivePath();

      slice.events.subscribe('router:change', () => this.syncActivePath());
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
