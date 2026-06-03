export default class ShoppingSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   init() {}
}

customElements.define('slice-shopping-section', ShoppingSection);
