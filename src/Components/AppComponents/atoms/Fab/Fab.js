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
         slice.events.emit('ui:modal:open', {});
      });
   }
}

customElements.define('slice-fab', Fab);
