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
      this._openToken = 0;
      this._opening = false;
      this._openPending = null;
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

      this._onModalOpen = (payload) => this.open(payload);
      this._onModalClose = () => this.close();
      slice.events.subscribe('ui:modal:open', this._onModalOpen, { component: this });
      slice.events.subscribe('ui:modal:close', this._onModalClose, { component: this });
   }

   getAppShell() {
      return this.closest('.app-shell');
   }

   formSliceId(payload = {}) {
      const resourceId =
         payload.blockId ?? payload.taskId ?? payload.domainId ?? payload.shoppingId ?? null;
      return `modal-${payload.form?.toLowerCase() ?? 'form'}${resourceId ? `-${resourceId}` : ''}`;
   }

   unmountForm(sliceId = null) {
      const ids = new Set();
      if (sliceId) {
         ids.add(sliceId);
      }
      if (this._currentForm?.sliceId) {
         ids.add(this._currentForm.sliceId);
      }

      for (const id of ids) {
         if (slice.controller.activeComponents.has(id)) {
            slice.controller.destroyComponent(id);
         }
      }

      this._currentForm = null;
      this.$body.innerHTML = '';
   }

   async open(payload = {}) {
      if (this._opening) {
         this._openPending = payload;
         return;
      }

      this._opening = true;
      try {
         await this._doOpen(payload);
         while (this._openPending) {
            const next = this._openPending;
            this._openPending = null;
            await this._doOpen(next);
         }
      } finally {
         this._opening = false;
      }
   }

   async _doOpen(payload = {}) {
      const token = ++this._openToken;
      const formSliceId = this.formSliceId(payload);

      this.unmountForm(formSliceId);
      this.$title.textContent = payload.title ?? 'Nuevo';

      if (!payload.form) {
         this.$root.hidden = false;
         document.addEventListener('keydown', this._onKeydown);
         this.getAppShell()?.classList.add('app-shell--modal-open');
         return;
      }

      const form = await slice.build(payload.form, {
         sliceId: formSliceId,
         blockId: payload.blockId ?? null,
         taskId: payload.taskId ?? null,
         domainId: payload.domainId ?? null,
         shoppingId: payload.shoppingId ?? null
      });

      if (token !== this._openToken) {
         if (form?.sliceId) {
            this.unmountForm(form.sliceId);
         }
         return;
      }

      if (!form) {
         this.$body.innerHTML = '<p class="lc-empty">No se pudo cargar el formulario.</p>';
      } else {
         this._currentForm = form;
         this.$body.appendChild(form);
      }

      this.$root.hidden = false;
      document.addEventListener('keydown', this._onKeydown);
      this.getAppShell()?.classList.add('app-shell--modal-open');
   }

   close() {
      this._openToken += 1;
      this._openPending = null;
      this.unmountForm();
      this.$root.hidden = true;
      document.removeEventListener('keydown', this._onKeydown);
      this.getAppShell()?.classList.remove('app-shell--modal-open');
      slice.events.emit('ui:modal:closed', {});
   }
}

customElements.define('slice-modal-shell', ModalShell);
