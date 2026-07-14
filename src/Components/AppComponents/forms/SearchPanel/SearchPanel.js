import { closeModal } from '../formHelpers.js';

function normalize(text) {
   return (text ?? '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
}

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
   }

   collectItems() {
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
         items.push({ kind: 'Nota', text: note.title, sub: note.body?.slice(0, 60) ?? '', route: '/notes' });
      }
      for (const domain of state.domains ?? []) {
         items.push({ kind: 'Dominio', text: domain.name, sub: '', route: '/settings' });
      }

      return items;
   }

   runSearch() {
      const query = normalize(this.$input.value.trim());
      this.$results.innerHTML = '';

      if (!query) {
         this.$empty.hidden = false;
         this.$empty.textContent = 'Escribe para buscar en toda la app.';
         return;
      }

      const matches = this.collectItems().filter(
         (item) => normalize(item.text).includes(query) || normalize(item.sub).includes(query)
      );

      if (matches.length === 0) {
         this.$empty.hidden = false;
         this.$empty.textContent = 'Sin resultados.';
         return;
      }

      this.$empty.hidden = true;

      for (const match of matches.slice(0, 30)) {
         const li = document.createElement('li');
         li.className = 'search-panel__result';
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
