export default class MultiRoute extends HTMLElement {
   constructor(props) {
      super();
      this.renderedComponents = new Map();
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      if (!this.routes || !Array.isArray(this.routes)) {
         slice.logger.logError('MultiRoute', 'No valid routes array provided in props.');
         return;
      }

      await this.render();
      // NOTE: MultiRoute does NOT register its routes in the Router. `routes.js` is the single
      // source of truth for what the Router knows. The Router resolves the URL on first load /
      // refresh / deep-link BEFORE this component mounts, so a path that only lived inside a
      // MultiRoute would 404 on a direct load — incoherent. Declare every section path in
      // `routes.js` (pointing at the shell); MultiRoute just chooses which one to show.
   }

   /**
    * Encuentra una ruta que coincida con el path actual
    * Soporta rutas estáticas y dinámicas con parámetros ${param}
    */
   matchRoute(currentPath) {
      // Normalize trailing slash so '/about/' behaves like '/about' (keep root '/').
      currentPath = currentPath.length > 1 ? currentPath.replace(/\/+$/, '') : currentPath;

      // 1. Match exacto, case-insensitive ('/About' coincide con '/about')
      const lowerPath = currentPath.toLowerCase();
      const exactMatch = this.routes.find(
         (route) => (route.path.length > 1 ? route.path.replace(/\/+$/, '') : route.path).toLowerCase() === lowerPath
      );
      if (exactMatch) {
         return { route: exactMatch, params: {} };
      }

      // 2. Si no hay match exacto, buscar rutas dinámicas
      for (const route of this.routes) {
         if (route.path.includes('${')) {
            const { regex, paramNames } = this.compilePathPattern(route.path);
            const match = currentPath.match(regex);
            
            if (match) {
               // Extraer parámetros de la URL
               const params = {};
               paramNames.forEach((name, i) => {
                  params[name] = match[i + 1];
               });
               
               return { route, params };
            }
         }
      }

      // 3. No se encontró ninguna ruta
      return { route: null, params: {} };
   }

   /**
    * Convierte un patrón de ruta con ${param} en una expresión regular
    * Ejemplo: "/user/${id}" -> /^\/user\/([^/]+)$/
    */
   compilePathPattern(pattern) {
      const paramNames = [];
      const regexPattern = '^' + pattern.replace(/\$\{([^}]+)\}/g, (_, paramName) => {
         paramNames.push(paramName);
         return '([^/]+)'; // Captura cualquier caracter excepto /
      }) + '$';

      return {
         // 'i': case-insensitive path matching. Captured param values keep their original case.
         regex: new RegExp(regexPattern, 'i'),
         paramNames
      };
   }

   _clearSectionInstances() {
      for (const id of [...slice.controller.activeComponents.keys()]) {
         if (id.startsWith('section-')) {
            slice.controller.destroyComponent(id);
         }
      }
      this.renderedComponents.clear();
   }

   async render() {
      if (this._rendering) {
         this._renderPending = true;
         return;
      }

      this._rendering = true;
      try {
         do {
            this._renderPending = false;
            await this._renderCurrentSection();
         } while (this._renderPending);
      } finally {
         this._rendering = false;
      }
   }

   async _renderCurrentSection() {
      const currentPath = window.location.pathname;
      const normalizedPath = currentPath.length > 1 ? currentPath.replace(/\/+$/, '') : currentPath;
      const { route: routeMatch, params } = this.matchRoute(normalizedPath);

      this._clearSectionInstances();
      this.innerHTML = '';

      if (!routeMatch) {
         return;
      }

      const { component, metadata } = routeMatch;

      if (!slice.controller.componentCategories.has(component) && !slice.controller.classes.has(component)) {
         slice.logger.logError(`${this.sliceId}`, `Component ${component} not found`);
         return;
      }

      const sectionSliceId = `section-${component}`;
      const section = await slice.build(component, {
         sliceId: sectionSliceId,
         params,
         metadata: metadata || {}
      });

      if (!section) {
         this.innerHTML = '<p class="lc-empty">No se pudo cargar la vista.</p>';
         return;
      }

      this.renderedComponents.set(normalizedPath, section);
      this.appendChild(section);

      this.dispatchEvent(new CustomEvent('route-rendered', {
         bubbles: true,
         detail: {
            component,
            path: normalizedPath,
            params,
            metadata: metadata || {}
         }
      }));
   }

   async renderIfCurrentRoute() {
      const currentPath = window.location.pathname;
      const { route: routeMatch } = this.matchRoute(currentPath);

      if (routeMatch) {
         await this.render();
         return true;
      }
      return false;
   }

   removeComponent() {
      const currentPath = window.location.pathname;
      const { route: routeMatch } = this.matchRoute(currentPath);

      if (routeMatch) {
         const { component } = routeMatch;
         this.renderedComponents.delete(component);
         this.innerHTML = '';
      }
   }

   /**
    * Cleanup cuando el componente se destruye
    */
   destroy() {
      this.renderedComponents.clear();
      this.innerHTML = '';
   }
}

customElements.define('slice-multi-route', MultiRoute);
