export default class TaskCard extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'task-card' },
      task: { type: 'object', default: null },
      domainColor: { type: 'string', default: '#71717a' },
      draggable: { type: 'boolean', default: true },
      onToggleComplete: { type: 'function', default: null },
      onRemoveFromBlock: { type: 'function', default: null },
      onEdit: { type: 'function', default: null },
      onDelete: { type: 'function', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$root = this.querySelector('[data-role="root"]');
      this.$check = this.querySelector('[data-role="check"]');
      this.$title = this.querySelector('[data-role="title"]');
      this.$urgency = this.querySelector('[data-role="urgency"]');
      this.$minutes = this.querySelector('[data-role="minutes"]');
      this.$accent = this.querySelector('[data-role="accent"]');
      this.$grip = this.querySelector('[data-role="grip"]');
      this.$remove = this.querySelector('[data-role="remove"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      this.$delete = this.querySelector('[data-role="delete"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$check.addEventListener('change', () => {
         if (typeof this.onToggleComplete === 'function') {
            this.onToggleComplete(this.$check.checked);
         }
      });

      if (this.draggable) {
         this.addEventListener('dragstart', (event) => {
            if (this.task?.id) {
               event.dataTransfer.setData('text/task-id', this.task.id);
               event.dataTransfer.effectAllowed = 'move';
            }
         });
      }

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

      this.paint();
   }

   paint() {
      const task = this.task;
      if (!task) {
         return;
      }

      const urgency = task.urgency || 'medium';
      const completed = !!task.completed;

      this.$title.textContent = task.title;
      this.$minutes.textContent = `${task.minutes} min`;
      this.$urgency.textContent = URGENCY_LABELS[urgency] ?? urgency;
      this.$urgency.className = `task-card__urgency task-card__urgency--${urgency}`;
      this.$accent.style.backgroundColor = this.domainColor;
      this.$check.checked = completed;
      this.classList.toggle('task-card--completed', completed);
      this.classList.toggle('task-card--locked', !this.draggable);
      this.setAttribute('draggable', this.draggable ? 'true' : 'false');
      this.$grip.hidden = !this.draggable;
      this.$remove.hidden = typeof this.onRemoveFromBlock !== 'function';
      this.$edit.hidden = typeof this.onEdit !== 'function';
      this.$delete.hidden = typeof this.onDelete !== 'function';
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
