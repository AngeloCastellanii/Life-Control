const THEMES = ['Light', 'Dark', 'Slice'];

export default class ThemeSelector extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'theme-selector' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$select = this.querySelector('[data-role="select"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.syncSelect();

      this.$select.addEventListener('change', async () => {
         const next = this.$select.value;
         if (!THEMES.includes(next)) {
            return;
         }
         await slice.setTheme(next);
         slice.events.emit('theme:changed', { theme: next });
      });
   }

   syncSelect() {
      const current = THEMES.includes(slice.theme) ? slice.theme : 'Light';
      this.$select.value = current;
   }
}

customElements.define('slice-theme-selector', ThemeSelector);
