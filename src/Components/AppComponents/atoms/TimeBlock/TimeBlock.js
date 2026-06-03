export default class TimeBlock extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'time-block' },
      block: { type: 'object', default: null },
      usedMinutes: { type: 'number', default: 0 },
      onRemove: { type: 'function', default: null },
      onEdit: { type: 'function', default: null },
      onDropTask: { type: 'function', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$root = this.querySelector('[data-role="root"]');
      this.$label = this.querySelector('[data-role="label"]');
      this.$time = this.querySelector('[data-role="time"]');
      this.$capacity = this.querySelector('[data-role="capacity"]');
      this.$dropzone = this.querySelector('[data-role="dropzone"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$hint = this.querySelector('.time-block__hint');
      this.$delete = this.querySelector('[data-role="delete"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.$edit.addEventListener('click', () => {
         if (typeof this.onEdit === 'function') {
            this.onEdit(this.block?.id);
         }
      });

      this.$delete.addEventListener('click', () => {
         if (typeof this.onRemove === 'function') {
            this.onRemove(this.block?.id);
         }
      });

      this.$dropzone.addEventListener('dragover', (event) => {
         event.preventDefault();
         this.$dropzone.classList.add('time-block__dropzone--active');
      });

      this.$dropzone.addEventListener('dragleave', () => {
         this.$dropzone.classList.remove('time-block__dropzone--active');
      });

      this.$dropzone.addEventListener('drop', (event) => {
         event.preventDefault();
         this.$dropzone.classList.remove('time-block__dropzone--active');
         const taskId = event.dataTransfer.getData('text/task-id');
         if (taskId && typeof this.onDropTask === 'function') {
            this.onDropTask(taskId, this.block?.id);
         }
      });

      this.paint();
   }

   paint() {
      const block = this.block;
      if (!block) {
         return;
      }

      const used = Number(this.usedMinutes) || 0;
      const duration = block.duration ?? 0;
      const remaining = Math.max(0, duration - used);
      const overflow = used > duration;

      const end = block.end ?? block.start;
      this.$label.textContent = block.label;
      this.$time.textContent = `${block.start} – ${end}`;
      this.$capacity.textContent = `${remaining} min restantes · ${used}/${duration}`;
      this.classList.toggle('time-block--overflow', overflow);
   }

   setTaskContainer(container) {
      this.$tasks = container;
   }

   async update() {
      this.paint();
   }
}

customElements.define('slice-time-block', TimeBlock);
