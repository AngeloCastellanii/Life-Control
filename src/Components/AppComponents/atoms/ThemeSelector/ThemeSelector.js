export default class ThemeSelector extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'theme-selector' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$btn = this.querySelector('.theme-selector__btn');
      this.$icon = this.querySelector('[data-role="icon"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$btn.addEventListener('click', () => this.toggleTheme());
      this.syncIcon();
   }

   async toggleTheme() {
      const next = slice.theme === 'Dark' ? 'Light' : 'Dark';
      await slice.setTheme(next);
      this.syncIcon();
      slice.events.emit('theme:changed', { theme: next });
   }

   syncIcon() {
      const isDark = slice.theme === 'Dark';
      this.$icon.textContent = isDark ? '☀' : '☾';
      this.$btn.setAttribute(
         'aria-label',
         isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
      );
   }
}

customElements.define('slice-theme-selector', ThemeSelector);
