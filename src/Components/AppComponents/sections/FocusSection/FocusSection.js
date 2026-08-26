export default class FocusSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'focus-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      slice.events.emit('ui:focus:open');
      await slice.router?.navigate?.('/');
   }
}

customElements.define('slice-focus-section', FocusSection);
