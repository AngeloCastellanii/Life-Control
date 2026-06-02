export default class AppShell extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$header = this.querySelector('.app-shell__header');
      this.$content = this.querySelector('.app-shell__content');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      const themeSelector = await slice.build('ThemeSelector', {
         sliceId: 'theme-selector'
      });
      this.$header.appendChild(themeSelector);

      const navbar = await slice.build('Navbar', {
         sliceId: 'app-navbar',
         position: 'fixed',
         items: [
            { text: 'Home', path: '/' },
            { text: 'About', path: '/about' },
            { text: 'Dominios', path: '/domains' }
         ]
      });
      this.$header.appendChild(navbar);

      const content = await slice.build('MultiRoute', {
         sliceId: 'app-content',
         routes: [
            { path: '/', component: 'HomeSection' },
            { path: '/about', component: 'AboutSection' },
            { path: '/domains', component: 'DomainsSection' }
         ]
      });
      this.$content.appendChild(content);
   }
}

customElements.define('slice-app-shell', AppShell);
