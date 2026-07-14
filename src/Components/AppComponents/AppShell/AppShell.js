import { preloadModalForms } from '../forms/preloadForms.js';
import { shouldShowOnboarding } from '../atoms/OnboardingOverlay/OnboardingOverlay.js';

export default class AppShell extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$sidebar = this.querySelector('[data-role="sidebar"]');
      this.$content = this.querySelector('.app-shell__content');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      await preloadModalForms();

      const sidebar = await slice.build('Sidebar', {
         sliceId: 'app-sidebar',
         items: [
            { text: 'Dashboard', path: '/' },
            { text: 'Planificador', path: '/planner' },
            { text: 'Finanzas', path: '/finances' },
            { text: 'Compras', path: '/shopping' },
            { text: 'Notas', path: '/notes' },
            { text: 'Enfoque', path: '/focus' },
            { text: 'Estadísticas', path: '/stats' },
            { text: 'Vision Board', path: '/vision' },
            { text: 'Perfil', path: '/settings' }
         ]
      });
      this.$sidebar.appendChild(sidebar);

      this.$multiRoute = await slice.build('MultiRoute', {
         sliceId: 'app-content',
         routes: [
            { path: '/', component: 'DashboardSection' },
            { path: '/planner', component: 'PlannerSection' },
            { path: '/finances', component: 'FinancesSection' },
            { path: '/shopping', component: 'ShoppingSection' },
            { path: '/notes', component: 'NotesSection' },
            { path: '/focus', component: 'FocusSection' },
            { path: '/stats', component: 'StatsSection' },
            { path: '/vision', component: 'VisionSection' },
            { path: '/settings', component: 'SettingsSection' }
         ]
      });
      this.$content.appendChild(this.$multiRoute);
      if (typeof this.$multiRoute.render === 'function') {
         await this.$multiRoute.render();
      }

      const modalShell = await slice.build('ModalShell', { sliceId: 'modal-shell' });
      this.appendChild(modalShell);

      const fab = await slice.build('Fab', { sliceId: 'app-fab' });
      this.appendChild(fab);

      if (shouldShowOnboarding() && !slice.controller.activeComponents.has('onboarding-overlay')) {
         const onboarding = await slice.build('OnboardingOverlay', { sliceId: 'onboarding-overlay' });
         if (onboarding) {
            this.appendChild(onboarding);
         }
      }
   }

   async update() {
      const multiRoute =
         this.$multiRoute ??
         slice.getComponent('app-content') ??
         this.querySelector('slice-multi-route');

      if (typeof multiRoute?.render === 'function') {
         await multiRoute.render();
      }
   }
}

customElements.define('slice-app-shell', AppShell);
