export default class FinancesSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      slice.controller.setComponentProps(this, props);
   }

   init() {}
}

customElements.define('slice-finances-section', FinancesSection);
