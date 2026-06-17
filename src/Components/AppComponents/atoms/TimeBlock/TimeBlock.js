import { BLOCK_RULE } from '../../sections/lifeControlConstants.js';

const RULE_LABELS = {
   [BLOCK_RULE.FLEXIBLE]: 'FLEXIBLE',
   [BLOCK_RULE.LOCKED]: 'FIJO'
};

const collapsedByBlock = new Map();

export default class TimeBlock extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'time-block' },
      block: { type: 'object', default: null },
      usedMinutes: { type: 'number', default: 0 },
      taskCount: { type: 'number', default: 0 },
      onRemove: { type: 'function', default: null },
      onEdit: { type: 'function', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$label = this.querySelector('[data-role="label"]');
      this.$time = this.querySelector('[data-role="time"]');
      this.$usage = this.querySelector('[data-role="usage"]');
      this.$free = this.querySelector('[data-role="free"]');
      this.$progressBar = this.querySelector('[data-role="progress-bar"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$rule = this.querySelector('[data-role="rule"]');
      this.$delete = this.querySelector('[data-role="delete"]');
      this.$edit = this.querySelector('[data-role="edit"]');
      this.$toggleTasks = this.querySelector('[data-role="toggle-tasks"]');
      this._collapsed = collapsedByBlock.get(this.block?.id) ?? false;
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

      this.$toggleTasks.addEventListener('click', () => {
         this._collapsed = !this._collapsed;
         if (this.block?.id) {
            collapsedByBlock.set(this.block.id, this._collapsed);
         }
         this.applyTasksCollapsed();
      });

      this.paint();
   }

   applyTasksCollapsed() {
      const collapsed = !!this._collapsed;
      this.$tasks.hidden = collapsed;
      this.$empty.hidden = collapsed || (Number(this.taskCount) || 0) > 0;
      this.$toggleTasks.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      this.$toggleTasks.textContent = collapsed ? '▸ Tareas' : '▾ Tareas';
      this.classList.toggle('time-block--tasks-collapsed', collapsed);
   }

   paint() {
      const block = this.block;
      if (!block) {
         return;
      }

      if (this.block?.id) {
         this._collapsed = collapsedByBlock.get(this.block.id) ?? false;
      }

      const used = Number(this.usedMinutes) || 0;
      const duration = block.duration ?? 0;
      const remaining = Math.max(0, duration - used);
      const overflow = used > duration;
      const count = Number(this.taskCount) || 0;
      const percent = duration ? Math.min(100, Math.round((used / duration) * 100)) : 0;

      const end = block.end ?? block.start;
      const rule = block.rule ?? BLOCK_RULE.FLEXIBLE;
      const locked = rule === BLOCK_RULE.LOCKED;

      this.$label.textContent = block.label;
      this.$time.textContent = `${block.start} — ${end}`;
      this.$rule.textContent = locked ? '🔒 FIJO' : RULE_LABELS[BLOCK_RULE.FLEXIBLE];
      this.$rule.classList.toggle('time-block__rule--flexible', !locked);
      this.$rule.classList.toggle('time-block__rule--fixed', locked);
      this.$usage.textContent = `${used} / ${duration} min`;
      this.$free.textContent = `${remaining}M LIBRES`;
      this.$progressBar.style.width = `${percent}%`;
      this.classList.toggle('time-block--overflow', overflow);
      this.classList.toggle('time-block--locked', locked);
      this.$empty.hidden = count > 0;
      this.$empty.textContent = locked
         ? 'Bloque bloqueado — no admite tareas.'
         : 'Sin tareas en este bloque.';
      this.applyTasksCollapsed();
   }

   async update() {
      this.paint();
   }
}

customElements.define('slice-time-block', TimeBlock);
