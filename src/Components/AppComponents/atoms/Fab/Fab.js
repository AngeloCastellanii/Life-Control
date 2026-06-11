const MODAL_BY_PATH = {
   '/': { title: 'Nueva tarea en inbox', form: 'TaskForm' },
   '/domains': { title: 'Nuevo dominio', form: 'DomainForm' },
   '/planner': { title: 'Nueva tarea', form: 'TaskForm' },
   '/finances': { title: 'Nueva transacción', form: 'FinanceForm' },
   '/shopping': { title: 'Nuevo artículo', form: 'ShoppingForm' }
};

export default class Fab extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'app-fab' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$btn = this.querySelector('.fab');
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.syncVisibility();

      this.$btn.addEventListener('click', () => {
         const path = window.location.pathname.replace(/\/+$/, '') || '/';
         const payload = MODAL_BY_PATH[path];
         if (payload) {
            slice.events.emit('ui:modal:open', payload);
         }
      });

      slice.events.subscribe('router:change', () => this.syncVisibility());
   }

   syncVisibility() {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      const hasForm = Boolean(MODAL_BY_PATH[path]);
      this.$btn.hidden = !hasForm;
      this.hidden = !hasForm;
   }
}

customElements.define('slice-fab', Fab);
