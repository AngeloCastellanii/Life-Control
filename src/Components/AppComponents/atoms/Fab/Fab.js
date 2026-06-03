const MODAL_BY_PATH = {
   '/domains': { title: 'Nuevo dominio', form: 'DomainForm' },
   '/': { title: 'Nueva tarea', form: 'TaskForm' }
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
      this.$btn.addEventListener('click', () => {
         const path = window.location.pathname.replace(/\/+$/, '') || '/';
         const payload = MODAL_BY_PATH[path] ?? MODAL_BY_PATH['/'];
         slice.events.emit('ui:modal:open', payload);
      });
   }
}

customElements.define('slice-fab', Fab);
