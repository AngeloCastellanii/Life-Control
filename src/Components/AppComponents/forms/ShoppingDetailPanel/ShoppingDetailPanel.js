import { formatShortDate, getDueStatus } from '../../sections/shoppingDue.js';
import { closeModal } from '../formHelpers.js';
import { shoppingItemById } from '../../sections/shoppingLookup.js';

const FREQUENCY_LABELS = {
   daily: 'Diaria',
   weekly: 'Semanal',
   monthly: 'Mensual',
   yearly: 'Anual'
};

export default class ShoppingDetailPanel extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'shopping-detail-panel' },
      shoppingId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$name = this.querySelector('[data-role="name"]');
      this.$meta = this.querySelector('[data-role="meta"]');
      this.$pause = this.querySelector('[data-role="pause"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      this.$delete = this.querySelector('[data-role="delete"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.shoppingService = slice.getComponent('shopping-service');
      this.$pause.addEventListener('click', () => this.togglePause());
      this.$edit.addEventListener('click', () => this.openEdit());
      this.$delete.addEventListener('click', () => this.removeItem());

      slice.context.watch(
         'lifeControl',
         this,
         () => this.paint(),
         (state) => state?.shopping ?? []
      );
      this.paint();
   }

   item() {
      return shoppingItemById(this.shoppingId, this.shoppingService);
   }

   paint() {
      const item = this.item();
      if (!item) {
         this.$name.textContent = 'Artículo no encontrado';
         this.$meta.textContent = '';
         this.$pause.hidden = true;
         this.$edit.hidden = true;
         this.$delete.hidden = true;
         return;
      }

      const period = FREQUENCY_LABELS[item.frequency] ?? item.frequency;
      const status = getDueStatus(item);
      const parts = [`Lista ${period.toLowerCase()}`, status.label];
      if (item.price != null && Number(item.price) > 0) {
         parts.push(`$${Number(item.price).toFixed(2)}`);
      }
      if (item.lastDoneAt) {
         parts.push(`Última vez: ${formatShortDate(item.lastDoneAt)}`);
      }
      if (item.nextDueAt && !status.label.startsWith('Próximo:') && !item.paused) {
         parts.push(`Próximo: ${formatShortDate(item.nextDueAt)}`);
      }

      this.$name.textContent = item.name;
      this.$meta.textContent = parts.join(' · ');
      this.$pause.hidden = false;
      this.$pause.textContent = item.paused ? 'Activar' : 'Poner en reposo';
      this.$edit.hidden = false;
      this.$delete.hidden = false;
   }

   async togglePause() {
      const item = this.item();
      if (!item || !this.shoppingService?.setPaused) {
         return;
      }
      await this.shoppingService.setPaused(item.id, !item.paused);
   }

   openEdit() {
      const item = this.item();
      if (!item) {
         return;
      }
      slice.events.emit('ui:modal:open', {
         title: 'Editar artículo',
         form: 'ShoppingForm',
         shoppingId: item.id
      });
   }

   async removeItem() {
      const item = this.item();
      if (!item || !this.shoppingService?.remove) {
         return;
      }
      if (!window.confirm(`¿Eliminar "${item.name}"?`)) {
         return;
      }
      await this.shoppingService.remove(item.id);
      closeModal();
   }
}

customElements.define('slice-shopping-detail-panel', ShoppingDetailPanel);
