const NAV_LAYOUT_KEY = 'lc_nav_layout';
const CLICK_DELAY_MS = 280;

export function getNavLayout() {
   try {
      const stored = localStorage.getItem(NAV_LAYOUT_KEY);
      return stored === 'bottom' ? 'bottom' : 'top';
   } catch {
      return 'top';
   }
}

export function setNavLayout(layout) {
   const next = layout === 'bottom' ? 'bottom' : 'top';
   try {
      localStorage.setItem(NAV_LAYOUT_KEY, next);
   } catch {
      /* ignore */
   }
   return next;
}

export function applyNavLayout(layout = getNavLayout()) {
   const root = document.querySelector('.app-shell');
   if (!root) {
      return layout;
   }
   root.classList.remove('app-shell--nav-side');
   root.classList.toggle('app-shell--nav-bottom', layout === 'bottom');
   return layout;
}

function lerp(a, b, t) {
   return a + (b - a) * t;
}

export default class Sidebar extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'app-sidebar' },
      items: { type: 'array', default: [] }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$list = this.querySelector('[data-role="list"]');
      this.$scroller = this.querySelector('[data-role="nav-scroller"]') ?? this.$list;
      this.$indicator = this.querySelector('[data-role="indicator"]');
      this.$footer = this.querySelector('[data-role="footer"]');
      this.$brand = this.querySelector('[data-role="brand"]');
      this._linkItems = [];
      this._brandClickTimer = null;
      this._activeIndex = 0;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      await this.renderItems();
      this.renderSearchButton();
      this.bindBrand();
      this.syncActivePath({ immediate: true });
      applyNavLayout();

      slice.events.subscribe('router:change', () => this.syncActivePath({ scroll: true }));
      slice.events.subscribe('nav:swipe-preview', (payload) => this.previewSwipe(payload), {
         component: this
      });
      slice.events.subscribe('nav:swipe-cancel', () => this.syncActivePath({ scroll: false }), {
         component: this
      });
      slice.events.subscribe('nav:layout', () => {
         requestAnimationFrame(() => this.moveIndicatorToIndex(this._activeIndex, { immediate: true }));
      });

      this._onResize = () => {
         this.moveIndicatorToIndex(this._activeIndex, { immediate: true });
      };
      window.addEventListener('resize', this._onResize);
   }

   bindBrand() {
      if (!this.$brand || this._brandBound) {
         return;
      }

      this.$brand.addEventListener('click', (event) => {
         event.preventDefault();

         if (this._brandClickTimer) {
            clearTimeout(this._brandClickTimer);
            this._brandClickTimer = null;
            this.toggleNavLayout();
            return;
         }

         this._brandClickTimer = setTimeout(() => {
            this._brandClickTimer = null;
            slice.router?.navigate?.('/');
         }, CLICK_DELAY_MS);
      });

      this._brandBound = true;
   }

   toggleNavLayout() {
      const next = setNavLayout(getNavLayout() === 'bottom' ? 'top' : 'bottom');
      applyNavLayout(next);
      slice.events.emit('nav:layout', { layout: next });
   }

   renderSearchButton() {
      if (!this.$footer || this.$footer.querySelector('.sidebar__search')) {
         return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sidebar__search';
      button.setAttribute('aria-label', 'Buscar');
      button.innerHTML =
         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg><span>Buscar</span>';
      button.addEventListener('click', () => {
         slice.events.emit('ui:modal:open', { title: 'Buscar', form: 'SearchPanel' });
      });
      this.$footer.appendChild(button);
   }

   async renderItems() {
      // Conserva el indicador si ya está en el DOM
      const indicator = this.$indicator;
      this.$list.innerHTML = '';
      if (indicator) {
         this.$list.appendChild(indicator);
         this.$indicator = indicator;
      } else {
         const el = document.createElement('li');
         el.className = 'sidebar__indicator';
         el.dataset.role = 'indicator';
         el.setAttribute('aria-hidden', 'true');
         this.$list.appendChild(el);
         this.$indicator = el;
      }

      this._linkItems = [];

      for (const item of this.items ?? []) {
         const li = document.createElement('li');
         li.className = 'sidebar__item';
         li.dataset.path = item.path;

         const link = await slice.build('Link', {
            text: item.text,
            path: item.path,
            classes: 'sidebar__link'
         });
         li.appendChild(link);
         this.$list.appendChild(li);
         this._linkItems.push(li);
      }
   }

   pathIndex(path) {
      const normalized = (path || '/').replace(/\/+$/, '') || '/';
      return this._linkItems.findIndex((li) => {
         const itemPath = (li.dataset.path || '/').replace(/\/+$/, '') || '/';
         return (
            normalized === itemPath ||
            (itemPath !== '/' && normalized.startsWith(`${itemPath}/`))
         );
      });
   }

   syncActivePath({ scroll = true, immediate = false } = {}) {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      let activeIndex = -1;

      for (let index = 0; index < this._linkItems.length; index += 1) {
         const li = this._linkItems[index];
         const itemPath = (li.dataset.path || '/').replace(/\/+$/, '') || '/';
         const isActive =
            path === itemPath || (itemPath !== '/' && path.startsWith(`${itemPath}/`));
         li.classList.toggle('sidebar__item--active', isActive);
         if (isActive) {
            activeIndex = index;
         }
      }

      if (activeIndex < 0) {
         activeIndex = 0;
      }

      this._activeIndex = activeIndex;
      this.moveIndicatorToIndex(activeIndex, { immediate, scroll });
   }

   itemMetrics(index) {
      const li = this._linkItems[index];
      if (!li || !this.$list) {
         return null;
      }
      const list = this.$list;
      const left = li.offsetLeft;
      const width = li.offsetWidth;
      return { li, left, width, list };
   }

   moveIndicatorToIndex(index, { immediate = false, scroll = true } = {}) {
      const metrics = this.itemMetrics(index);
      if (!metrics || !this.$indicator) {
         return;
      }

      const { li, left, width } = metrics;
      if (immediate) {
         this.$indicator.classList.add('sidebar__indicator--instant');
      } else {
         this.$indicator.classList.remove('sidebar__indicator--instant');
      }

      this.$indicator.style.width = `${Math.max(width, 8)}px`;
      this.$indicator.style.transform = `translate3d(${left}px, 0, 0)`;
      this.$indicator.classList.add('sidebar__indicator--ready');

      if (immediate) {
         requestAnimationFrame(() => {
            this.$indicator?.classList.remove('sidebar__indicator--instant');
         });
      }

      if (scroll) {
         this.scrollItemIntoView(li);
      }
   }

   scrollItemIntoView(li) {
      if (!li || !this.$scroller) {
         return;
      }
      const scroller = this.$scroller;
      const itemLeft = li.offsetLeft;
      const itemRight = itemLeft + li.offsetWidth;
      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + scroller.clientWidth;
      const pad = 24;

      let next = viewLeft;
      if (itemLeft - pad < viewLeft) {
         next = itemLeft - pad;
      } else if (itemRight + pad > viewRight) {
         next = itemRight + pad - scroller.clientWidth;
      } else {
         // Centrar suavemente si cabe
         next = itemLeft - (scroller.clientWidth - li.offsetWidth) / 2;
      }

      next = Math.max(0, Math.min(next, scroller.scrollWidth - scroller.clientWidth));
      scroller.scrollTo({ left: next, behavior: 'smooth' });
   }

   previewSwipe({ fromIndex, toIndex, progress = 0 } = {}) {
      if (
         !Number.isFinite(fromIndex) ||
         !Number.isFinite(toIndex) ||
         fromIndex < 0 ||
         toIndex < 0 ||
         fromIndex >= this._linkItems.length ||
         toIndex >= this._linkItems.length
      ) {
         return;
      }

      const from = this.itemMetrics(fromIndex);
      const to = this.itemMetrics(toIndex);
      if (!from || !to || !this.$indicator) {
         return;
      }

      const t = Math.max(0, Math.min(1, progress));
      const left = lerp(from.left, to.left, t);
      const width = lerp(from.width, to.width, t);

      this.$indicator.classList.add('sidebar__indicator--instant');
      this.$indicator.style.width = `${Math.max(width, 8)}px`;
      this.$indicator.style.transform = `translate3d(${left}px, 0, 0)`;
      this.$indicator.classList.add('sidebar__indicator--ready');

      // Ir desplazando la barra hacia el destino mientras se desliza
      if (t > 0.15) {
         this.scrollItemIntoView(to.li);
      }
   }
}

customElements.define('slice-sidebar', Sidebar);
