import { preloadModalForms } from '../forms/preloadForms.js';
import { shouldShowOnboarding } from '../atoms/OnboardingOverlay/OnboardingOverlay.js';

const NAV_ROUTES = [
   '/',
   '/planner',
   '/finances',
   '/shopping',
   '/notes',
   '/focus',
   '/stats',
   '/vision',
   '/settings'
];

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

      this.setupSwipeNavigation();

      try {
         if (shouldShowOnboarding() && !slice.controller.activeComponents?.has?.('onboarding-overlay')) {
            const onboarding = await slice.build('OnboardingOverlay', { sliceId: 'onboarding-overlay' });
            if (onboarding) {
               this.appendChild(onboarding);
            }
         }
      } catch (error) {
         console.error('No se pudo mostrar el onboarding:', error);
      }
   }

   setupSwipeNavigation() {
      const stage = this.querySelector('.app-shell__stage');
      if (!stage || this._swipeBound) {
         return;
      }

      let startX = 0;
      let startY = 0;
      let tracking = false;
      let previewing = false;

      const isInteractive = (target) =>
         Boolean(
            target?.closest?.(
               'input, textarea, select, button, a, [contenteditable="true"], .modal-shell, .onboarding, .sidebar'
            )
         );

      const currentNavIndex = () => {
         const current = window.location.pathname.replace(/\/+$/, '') || '/';
         return NAV_ROUTES.indexOf(current);
      };

      stage.addEventListener(
         'touchstart',
         (event) => {
            if (event.touches.length !== 1 || isInteractive(event.target)) {
               tracking = false;
               previewing = false;
               return;
            }
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
            tracking = true;
            previewing = false;
         },
         { passive: true }
      );

      stage.addEventListener(
         'touchmove',
         (event) => {
            if (!tracking || !event.touches?.[0] || this.classList.contains('app-shell--modal-open')) {
               return;
            }

            const dx = event.touches[0].clientX - startX;
            const dy = event.touches[0].clientY - startY;
            if (Math.abs(dy) > Math.abs(dx) * 1.1) {
               if (previewing) {
                  slice.events.emit('nav:swipe-cancel', {});
                  previewing = false;
               }
               return;
            }

            const index = currentNavIndex();
            if (index < 0) {
               return;
            }

            const direction = dx < 0 ? 1 : -1;
            const toIndex = index + direction;
            if (toIndex < 0 || toIndex >= NAV_ROUTES.length) {
               return;
            }

            const progress = Math.min(1, Math.abs(dx) / 120);
            if (progress < 0.08) {
               return;
            }

            previewing = true;
            slice.events.emit('nav:swipe-preview', {
               fromIndex: index,
               toIndex,
               progress
            });
         },
         { passive: true }
      );

      stage.addEventListener(
         'touchend',
         (event) => {
            if (!tracking || !event.changedTouches?.[0]) {
               return;
            }
            tracking = false;

            const dx = event.changedTouches[0].clientX - startX;
            const dy = event.changedTouches[0].clientY - startY;
            if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) {
               if (previewing) {
                  slice.events.emit('nav:swipe-cancel', {});
               }
               previewing = false;
               return;
            }

            previewing = false;
            // Deslizar izquierda → vista siguiente; derecha → anterior
            this.navigateBySwipe(dx < 0 ? 1 : -1);
         },
         { passive: true }
      );

      stage.addEventListener(
         'touchcancel',
         () => {
            tracking = false;
            if (previewing) {
               slice.events.emit('nav:swipe-cancel', {});
            }
            previewing = false;
         },
         { passive: true }
      );

      this._swipeBound = true;
   }

   navigateBySwipe(direction) {
      if (this.classList.contains('app-shell--modal-open')) {
         return;
      }

      const current = window.location.pathname.replace(/\/+$/, '') || '/';
      const index = NAV_ROUTES.indexOf(current);
      if (index < 0) {
         return;
      }

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= NAV_ROUTES.length) {
         return;
      }

      const content = this.$content;
      content?.classList.remove('app-shell__content--swipe-left', 'app-shell__content--swipe-right');
      // force reflow for animation restart
      void content?.offsetWidth;
      content?.classList.add(
         direction > 0 ? 'app-shell__content--swipe-left' : 'app-shell__content--swipe-right'
      );

      window.setTimeout(() => {
         slice.router?.navigate?.(NAV_ROUTES[nextIndex]);
         content?.classList.remove('app-shell__content--swipe-left', 'app-shell__content--swipe-right');
      }, 160);
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
