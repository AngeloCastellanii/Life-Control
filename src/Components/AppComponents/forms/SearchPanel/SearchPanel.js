import { closeModal } from '../formHelpers.js';

function normalize(text) {
   return (text ?? '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
}

const VIEWS = [
   { kind: 'Vista', text: 'Dashboard', sub: 'Resumen del día', route: '/', aliases: ['inicio', 'home', 'resumen'] },
   { kind: 'Vista', text: 'Planificador', sub: 'Tareas y bloques', route: '/planner', aliases: ['planner', 'tareas', 'agenda'] },
   { kind: 'Vista', text: 'Finanzas', sub: 'Pagos y cobros', route: '/finances', aliases: ['dinero', 'pagos', 'cobros'] },
   { kind: 'Vista', text: 'Compras', sub: 'Lista de compras', route: '/shopping', aliases: ['shopping', 'super'] },
   { kind: 'Vista', text: 'Notas', sub: 'Notas y recordatorios', route: '/notes', aliases: ['nota', 'lista'] },
   { kind: 'Vista', text: 'Enfoque', sub: 'Bloque actual', route: '/focus', aliases: ['focus', 'concentracion'] },
   { kind: 'Vista', text: 'Estadísticas', sub: 'Progreso y presupuestos', route: '/stats', aliases: ['stats', 'estadisticas'] },
   { kind: 'Vista', text: 'Vision Board', sub: 'Metas visuales', route: '/vision', aliases: ['vision', 'metas', 'sueños'] },
   { kind: 'Vista', text: 'Perfil', sub: 'Ajustes y dominios', route: '/settings', aliases: ['settings', 'ajustes', 'configuracion'] }
];

export default class SearchPanel extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'search-panel' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$input = this.querySelector('[data-role="input"]');
      this.$results = this.querySelector('[data-role="results"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.$input.addEventListener('input', () => this.runSearch());
      setTimeout(() => this.$input?.focus(), 50);
      this.runSearch();
   }

   collectContent() {
      const state = slice.context.getState('lifeControl') ?? {};
      const items = [];

      for (const task of state.tasks ?? []) {
         items.push({
            kind: 'Tarea',
            text: task.title,
            sub: task.completed ? 'Completada' : 'Pendiente',
            route: '/planner'
         });
      }
      for (const finance of state.finances ?? []) {
         items.push({
            kind: finance.type === 'receive' ? 'Cobro' : 'Pago',
            text: finance.description,
            sub: `$${(Number(finance.amount) || 0).toFixed(2)}`,
            route: '/finances'
         });
      }
      for (const item of state.shopping ?? []) {
         items.push({ kind: 'Compra', text: item.name, sub: '', route: '/shopping' });
      }
      for (const note of state.notes ?? []) {
         const checklistText = (note.checklist ?? []).map((i) => i.text).join(' ');
         items.push({
            kind: note.type === 'list' ? 'Lista' : 'Nota',
            text: note.title,
            sub: note.body?.slice(0, 60) || checklistText.slice(0, 60) || '',
            route: '/notes'
         });
      }
      for (const vision of state.vision ?? []) {
         items.push({
            kind: 'Meta',
            text: vision.title,
            sub: vision.achieved ? 'Lograda' : vision.description?.slice(0, 60) || '',
            route: '/vision'
         });
      }
      for (const domain of state.domains ?? []) {
         items.push({ kind: 'Dominio', text: domain.name, sub: '', route: '/settings' });
      }

      return items;
   }

   matchViews(query) {
      if (!query) {
         return VIEWS.map((view) => ({ ...view, priority: 0 }));
      }
      return VIEWS.filter((view) => {
         const haystack = [view.text, view.sub, ...(view.aliases ?? [])].map(normalize).join(' ');
         return haystack.includes(query);
      }).map((view) => ({ ...view, priority: 0 }));
   }

   runSearch() {
      const raw = this.$input.value.trim();
      const query = normalize(raw);
      this.$results.innerHTML = '';

      const viewMatches = this.matchViews(query);
      const contentMatches = query
         ? this.collectContent().filter(
              (item) =>
                 normalize(item.text).includes(query) ||
                 normalize(item.sub).includes(query) ||
                 normalize(item.kind).includes(query)
           )
         : [];

      const matches = [...viewMatches, ...contentMatches];

      if (matches.length === 0) {
         this.$empty.hidden = false;
         this.$empty.textContent = query ? 'Sin resultados.' : 'Escribe para buscar vistas o contenido.';
         return;
      }

      this.$empty.hidden = true;

      if (!query) {
         const hint = document.createElement('li');
         hint.className = 'search-panel__hint';
         hint.textContent = 'Vistas';
         this.$results.appendChild(hint);
      }

      for (const match of matches.slice(0, 40)) {
         const li = document.createElement('li');
         li.className = 'search-panel__result';
         if (match.kind === 'Vista') {
            li.classList.add('search-panel__result--view');
         }
         li.setAttribute('role', 'button');
         li.tabIndex = 0;

         const kind = document.createElement('span');
         kind.className = 'search-panel__kind';
         kind.textContent = match.kind;

         const text = document.createElement('span');
         text.className = 'search-panel__text';
         text.textContent = match.text;

         if (match.sub) {
            const sub = document.createElement('span');
            sub.className = 'search-panel__sub';
            sub.textContent = match.sub;
            text.appendChild(sub);
         }

         li.append(kind, text);
         const go = () => {
            slice.router?.navigate?.(match.route);
            closeModal();
         };
         li.addEventListener('click', go);
         li.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
               event.preventDefault();
               go();
            }
         });
         this.$results.appendChild(li);
      }
   }
}

customElements.define('slice-search-panel', SearchPanel);
