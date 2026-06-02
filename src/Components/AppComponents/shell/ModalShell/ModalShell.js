export default class ModalShell extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'modal-shell' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$root = this.querySelector('[data-role="root"]');
      this.$backdrop = this.querySelector('[data-role="backdrop"]');
      this.$close = this.querySelector('[data-role="close"]');
      this.$title = this.querySelector('[data-role="title"]');
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.$close.addEventListener('click', () => this.close());
      this.$backdrop.addEventListener('click', () => this.close());

      this._onKeydown = (event) => {
         if (event.key === 'Escape') {
            this.close();
         }
      };

      slice.events.subscribe('ui:modal:open', (payload) => this.open(payload));
      slice.events.subscribe('ui:modal:close', () => this.close());
   }

   getAppShell() {
      return this.closest('.app-shell');
   }

   open(payload = {}) {
      if (payload.title) {
         this.$title.textContent = payload.title;
      }
      this.$root.hidden = false;
      document.addEventListener('keydown', this._onKeydown);
      this.getAppShell()?.classList.add('app-shell--modal-open');
   }

   close() {
      this.$root.hidden = true;
      document.removeEventListener('keydown', this._onKeydown);
      this.getAppShell()?.classList.remove('app-shell--modal-open');
      slice.events.emit('ui:modal:closed', {});
   }
}

customElements.define('slice-modal-shell', ModalShell);
