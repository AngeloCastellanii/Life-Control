export default class ShoppingSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'shopping-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   init() {}
}

customElements.define('slice-shopping-section', ShoppingSection);
