import { BLOCK_RULE } from '/Components/Service/TimeBlockService/TimeBlockService.js';

const RULE_LABELS = {
   [BLOCK_RULE.FLEXIBLE]: '🔓 Flexible',
   [BLOCK_RULE.LOCKED]: '🔒 Bloqueada'
};

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
      this.$capacity = this.querySelector('[data-role="capacity"]');
      this.$tasks = this.querySelector('[data-role="tasks"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this.$rule = this.querySelector('[data-role="rule"]');
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
      const count = Number(this.taskCount) || 0;

      const end = block.end ?? block.start;
      const rule = block.rule ?? BLOCK_RULE.FLEXIBLE;
      const locked = rule === BLOCK_RULE.LOCKED;

      this.$label.textContent = block.label;
      this.$time.textContent = `${block.start} – ${end}`;
      this.$rule.textContent = RULE_LABELS[rule] ?? RULE_LABELS[BLOCK_RULE.FLEXIBLE];
      this.$capacity.textContent = `${remaining} min restantes · ${used}/${duration}`;
      this.classList.toggle('time-block--overflow', overflow);
      this.classList.toggle('time-block--locked', locked);
      this.$empty.hidden = count > 0;
      this.$empty.textContent = locked
         ? 'Bloque bloqueado — no admite tareas.'
         : 'Sin tareas en este bloque.';
   }

   async update() {
      this.paint();
   }
}

customElements.define('slice-time-block', TimeBlock);
