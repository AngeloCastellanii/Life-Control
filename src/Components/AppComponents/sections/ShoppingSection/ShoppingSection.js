import {
   SHOPPING_FREQUENCY,
   getDueStatus
} from '/Components/Service/ShoppingService/ShoppingService.js';

const COLUMNS = [
   { frequency: SHOPPING_FREQUENCY.DAILY, list: 'daily-list', empty: 'daily-empty' },
   { frequency: SHOPPING_FREQUENCY.WEEKLY, list: 'weekly-list', empty: 'weekly-empty' },
   { frequency: SHOPPING_FREQUENCY.MONTHLY, list: 'monthly-list', empty: 'monthly-empty' },
   { frequency: SHOPPING_FREQUENCY.YEARLY, list: 'yearly-list', empty: 'yearly-empty' }
];

const FREQUENCY_LABELS = {
   [SHOPPING_FREQUENCY.DAILY]: 'Diaria',
   [SHOPPING_FREQUENCY.WEEKLY]: 'Semanal',
   [SHOPPING_FREQUENCY.MONTHLY]: 'Mensual',
   [SHOPPING_FREQUENCY.YEARLY]: 'Anual'
};

export default class ShoppingSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'shopping-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this._selectedByFrequency = {};
      this._detailItemId = null;

      this.$detail = this.querySelector('[data-role="detail"]');
      this.$detailPeriod = this.querySelector('[data-role="detail-period"]');
      this.$detailName = this.querySelector('[data-role="detail-name"]');
      this.$detailMeta = this.querySelector('[data-role="detail-meta"]');

      this.$columns = COLUMNS.map((col) => {
         const $col = this.querySelector(`[data-frequency="${col.frequency}"]`);
         return {
            ...col,
            $col,
            $list: this.querySelector(`[data-role="${col.list}"]`),
            $empty: this.querySelector(`[data-role="${col.empty}"]`),
            $editBtn: $col?.querySelector('[data-action="edit"]'),
            $deleteBtn: $col?.querySelector('[data-action="delete"]')
         };
      });

      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.shoppingService = slice.getComponent('shopping-service');
      if (!this.shoppingService) {
         slice.logger.logError('ShoppingSection', 'ShoppingService no disponible');
         return;
      }

      for (const col of this.$columns) {
         col.$editBtn?.addEventListener('click', () => this.editSelected(col.frequency));
         col.$deleteBtn?.addEventListener('click', () => this.deleteSelected(col.frequency));
      }

      slice.context.watch(
         'lifeControl',
         this,
         (shopping) => this.render(shopping),
         (state) => state?.shopping ?? []
      );

      this.render(this.shoppingService.getAll());
   }

   getSelectedId(frequency) {
      return this._selectedByFrequency[frequency] ?? null;
   }

   setSelected(frequency, itemId) {
      this._selectedByFrequency[frequency] = itemId;
      this.syncSelectionStyles();
      this.syncColumnButtons();
   }

   getSelectedItem(frequency) {
      const id = this.getSelectedId(frequency);
      if (!id) {
         return null;
      }
      return this.shoppingService.getById(id);
   }

   syncSelectionStyles() {
      for (const col of this.$columns) {
         const selectedId = this.getSelectedId(col.frequency);
         for (const row of col.$list.querySelectorAll('.shopping-section__item')) {
            row.classList.toggle('shopping-section__item--selected', row.dataset.id === selectedId);
         }
      }
   }

   syncColumnButtons() {
      for (const col of this.$columns) {
         const hasSelection = Boolean(this.getSelectedId(col.frequency));
         if (col.$editBtn) {
            col.$editBtn.disabled = !hasSelection;
         }
         if (col.$deleteBtn) {
            col.$deleteBtn.disabled = !hasSelection;
         }
      }
   }

   openEdit(shoppingId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar artículo',
         form: 'ShoppingForm',
         shoppingId
      });
   }

   editSelected(frequency) {
      const item = this.getSelectedItem(frequency);
      if (!item) {
         return;
      }
      this.openEdit(item.id);
   }

   async deleteSelected(frequency) {
      const item = this.getSelectedItem(frequency);
      if (!item) {
         return;
      }
      if (!window.confirm(`¿Eliminar "${item.name}"?`)) {
         return;
      }
      await this.shoppingService.remove(item.id);
      if (this._detailItemId === item.id) {
         this.hideDetail();
      }
      delete this._selectedByFrequency[frequency];
   }

   showDetail(item) {
      this._detailItemId = item.id;
      this.setSelected(item.frequency, item.id);

      const period = FREQUENCY_LABELS[item.frequency] ?? item.frequency;
      const status = getDueStatus(item);
      this.$detailPeriod.textContent = `Lista ${period.toLowerCase()}`;
      this.$detailName.textContent = item.name;

      const parts = [status.label];
      if (item.lastDoneAt) {
         parts.push(`Última vez: ${item.lastDoneAt}`);
      }
      if (item.nextDueAt) {
         parts.push(`Próxima: ${item.nextDueAt}`);
      }
      this.$detailMeta.textContent = parts.join(' · ');

      this.$detail.hidden = false;
   }

   hideDetail() {
      this._detailItemId = null;
      this.$detail.hidden = true;
   }

   renderColumn(frequency, listEl, emptyEl, items) {
      listEl.innerHTML = '';
      emptyEl.hidden = items.length > 0;

      const selectedId = this.getSelectedId(frequency);
      if (selectedId && !items.some((item) => item.id === selectedId)) {
         delete this._selectedByFrequency[frequency];
         if (this._detailItemId === selectedId) {
            this.hideDetail();
         }
      }

      for (const item of items) {
         const row = document.createElement('li');
         row.className = 'shopping-section__item';
         row.dataset.id = item.id;
         if (item.checked) {
            row.classList.add('shopping-section__item--checked');
         }
         if (item.id === this.getSelectedId(frequency)) {
            row.classList.add('shopping-section__item--selected');
         }

         const check = document.createElement('input');
         check.type = 'checkbox';
         check.className = 'shopping-section__check';
         check.checked = !!item.checked;
         check.addEventListener('change', () => {
            this.shoppingService.toggleChecked(item.id, check.checked);
         });

         const body = document.createElement('div');
         body.className = 'shopping-section__item-body';

         const nameBtn = document.createElement('button');
         nameBtn.type = 'button';
         nameBtn.className = 'shopping-section__item-name';
         nameBtn.textContent = item.name;
         nameBtn.title = item.name;
         nameBtn.addEventListener('click', () => this.showDetail(item));

         const due = document.createElement('span');
         const status = getDueStatus(item);
         due.className = `shopping-section__item-due shopping-section__item-due--${status.state}`;
         due.textContent = status.label;

         body.appendChild(nameBtn);
         body.appendChild(due);

         row.appendChild(check);
         row.appendChild(body);
         listEl.appendChild(row);
      }
   }

   render(shopping) {
      const list = Array.isArray(shopping) ? shopping : this.shoppingService.getAll();

      for (const col of this.$columns) {
         const items = list.filter((item) => item.frequency === col.frequency);
         this.renderColumn(col.frequency, col.$list, col.$empty, items);
      }

      this.syncColumnButtons();

      if (this._detailItemId) {
         const detailItem = this.shoppingService.getById(this._detailItemId);
         if (detailItem) {
            this.showDetail(detailItem);
         } else {
            this.hideDetail();
         }
      }
   }
}

customElements.define('slice-shopping-section', ShoppingSection);
