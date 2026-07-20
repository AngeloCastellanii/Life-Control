import { formatTaskSlotLabel } from '../../../Utils/taskSlotTimes.js';
import { formatDuration } from '../../../Utils/formatDuration.js';

export default class TaskCard extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'task-card' },
      task: { type: 'object', default: null },
      domainColor: { type: 'string', default: '#71717a' },
      domainName: { type: 'string', default: '' },
      assignBlocks: { type: 'array', default: null },
      onToggleComplete: { type: 'function', default: null },
      onAssignToBlock: { type: 'function', default: null },
      onRemoveFromBlock: { type: 'function', default: null },
      onEdit: { type: 'function', default: null },
      onDelete: { type: 'function', default: null },
      onOpenDetail: { type: 'function', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$check = this.querySelector('[data-role="check"]');
      this.$title = this.querySelector('[data-role="title"]');
      this.$domain = this.querySelector('[data-role="domain"]');
      this.$urgency = this.querySelector('[data-role="urgency"]');
      this.$slot = this.querySelector('[data-role="slot"]');
      this.$minutes = this.querySelector('[data-role="minutes"]');
      this.$accent = this.querySelector('[data-role="accent"]');
      this.$assign = this.querySelector('[data-role="assign-wrap"]');
      this.$blockSelect = this.querySelector('[data-role="block-select"]');
      this.$assignBtn = this.querySelector('[data-role="assign-btn"]');
      this.$remove = this.querySelector('[data-role="remove"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      this.$delete = this.querySelector('[data-role="delete"]');
      this.$body = this.querySelector('[data-role="body"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$check.addEventListener('change', () => {
         if (typeof this.onToggleComplete === 'function') {
            this.onToggleComplete(this.$check.checked);
         }
      });

      this.$assignBtn.addEventListener('click', () => {
         const blockId = this.$blockSelect.value;
         if (blockId && typeof this.onAssignToBlock === 'function') {
            this.onAssignToBlock(this.task?.id, blockId);
         }
      });

      this.$remove.addEventListener('click', () => {
         if (typeof this.onRemoveFromBlock === 'function') {
            this.onRemoveFromBlock(this.task?.id);
         }
      });

      this.$edit.addEventListener('click', () => {
         if (typeof this.onEdit === 'function') {
            this.onEdit(this.task?.id);
         }
      });

      this.$delete.addEventListener('click', () => {
         if (typeof this.onDelete === 'function') {
            this.onDelete(this.task?.id);
         }
      });

      this.$body.addEventListener('click', (event) => {
         if (typeof this.onOpenDetail !== 'function') {
            return;
         }
         if (event.target.closest('input, button, select, label')) {
            return;
         }
         this.onOpenDetail(this.task?.id);
      });

      this.paint();
   }

   fillBlockSelect() {
      const blocks = this.assignBlocks ?? [];
      this.$blockSelect.innerHTML = '';

      if (blocks.length === 0) {
         const option = document.createElement('option');
         option.value = '';
         option.textContent = 'Sin bloques';
         this.$blockSelect.appendChild(option);
         this.$blockSelect.disabled = true;
         this.$assignBtn.disabled = true;
         return;
      }

      this.$blockSelect.disabled = false;
      this.$assignBtn.disabled = false;
      for (const block of blocks) {
         const option = document.createElement('option');
         option.value = block.id;
         option.textContent = block.label;
         this.$blockSelect.appendChild(option);
      }
   }

   paint() {
      const task = this.task;
      if (!task) {
         return;
      }

      const urgency = task.urgency || 'medium';
      const completed = !!task.completed;

      this.$title.textContent = task.title;
      const slotLabel = formatTaskSlotLabel(task.slotStart, task.slotEnd);
      if (this.$slot) {
         if (slotLabel) {
            this.$slot.textContent = slotLabel;
            this.$slot.hidden = false;
         } else {
            this.$slot.hidden = true;
         }
      }
      this.$minutes.textContent = formatDuration(task.minutes ?? 0, { short: true });
      if (this.$domain) {
         const name = this.domainName?.trim();
         if (name) {
            this.$domain.textContent = name;
            this.$domain.style.setProperty('--domain-color', this.domainColor);
            this.$domain.hidden = false;
         } else {
            this.$domain.hidden = true;
         }
      }
      this.$urgency.textContent = URGENCY_LABELS[urgency] ?? urgency;
      this.$urgency.className = `task-card__urgency task-card__urgency--${urgency}`;
      this.$accent.style.backgroundColor = this.domainColor;
      this.$check.checked = completed;
      this.classList.toggle('task-card--completed', completed);

      const canAssign = typeof this.onAssignToBlock === 'function';
      this.$assign.hidden = !canAssign;
      this.classList.toggle('task-card--inbox', canAssign);
      if (canAssign) {
         this.fillBlockSelect();
      }

      this.$remove.hidden = typeof this.onRemoveFromBlock !== 'function';
      this.$edit.hidden = typeof this.onEdit !== 'function';
      this.$delete.hidden = typeof this.onDelete !== 'function';
      this.classList.toggle('task-card--clickable', typeof this.onOpenDetail === 'function');
   }

   async update() {
      this.paint();
   }
}

const URGENCY_LABELS = {
   high: 'Alta',
   medium: 'Media',
   low: 'Baja'
};

customElements.define('slice-task-card', TaskCard);
