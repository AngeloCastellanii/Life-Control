export default class AppShell extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$sidebar = this.querySelector('[data-role="sidebar"]');
      this.$content = this.querySelector('.app-shell__content');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      const sidebar = await slice.build('Sidebar', {
         sliceId: 'app-sidebar',
         items: [
            { text: 'Inicio', path: '/' },
            { text: 'Dominios', path: '/domains' }
         ]
      });
      this.$sidebar.appendChild(sidebar);

      const themeSelector = await slice.build('ThemeSelector', {
         sliceId: 'theme-selector'
      });
      sidebar.querySelector('[data-role="footer"]').appendChild(themeSelector);

      const content = await slice.build('MultiRoute', {
         sliceId: 'app-content',
         routes: [
            { path: '/', component: 'HomeSection' },
            { path: '/about', component: 'AboutSection' },
            { path: '/domains', component: 'DomainsSection' }
         ]
      });
      this.$content.appendChild(content);
      if (typeof content.render === 'function') {
         await content.render();
      }

      const modalShell = await slice.build('ModalShell', { sliceId: 'modal-shell' });
      this.appendChild(modalShell);

      const fab = await slice.build('Fab', { sliceId: 'app-fab' });
      this.appendChild(fab);
   }
}

customElements.define('slice-app-shell', AppShell);
