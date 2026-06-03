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
      this.$body = this.querySelector('[data-role="body"]');
      this._currentForm = null;
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

   unmountForm() {
      if (this._currentForm?.sliceId) {
         slice.controller.destroyComponent(this._currentForm.sliceId);
      }
      this._currentForm = null;
      this.$body.innerHTML = '';
   }

   async open(payload = {}) {
      this.unmountForm();
      this.$title.textContent = payload.title ?? 'Nuevo';

      if (payload.form) {
         const resourceId = payload.blockId ?? payload.taskId ?? null;
         const form = await slice.build(payload.form, {
            sliceId: `modal-${payload.form.toLowerCase()}${resourceId ? `-${resourceId}` : ''}`,
            blockId: payload.blockId ?? null,
            taskId: payload.taskId ?? null
         });
         if (form) {
            this._currentForm = form;
            this.$body.appendChild(form);
         }
      }

      this.$root.hidden = false;
      document.addEventListener('keydown', this._onKeydown);
      this.getAppShell()?.classList.add('app-shell--modal-open');
   }

   close() {
      this.unmountForm();
      this.$root.hidden = true;
      document.removeEventListener('keydown', this._onKeydown);
      this.getAppShell()?.classList.remove('app-shell--modal-open');
      slice.events.emit('ui:modal:closed', {});
   }
}

customElements.define('slice-modal-shell', ModalShell);
