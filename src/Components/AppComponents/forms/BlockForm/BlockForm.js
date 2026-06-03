function minutesBetween(start, end) {
   const [sh, sm] = start.split(':').map(Number);
   const [eh, em] = end.split(':').map(Number);
   let mins = eh * 60 + em - (sh * 60 + sm);
   if (mins <= 0) {
      mins += 24 * 60;
   }
   return mins;
}

export default class BlockForm extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'block-form' },
      blockId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$start = this.querySelector('#block-form-start');
      this.$end = this.querySelector('#block-form-end');
      this.$capacity = this.querySelector('#block-form-capacity');
      this.$error = this.querySelector('[data-role="error"]');
      this.$labelInput = this.querySelector('#block-form-label');
      this.$ruleSelect = this.querySelector('#block-form-rule');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.timeBlockService = slice.getComponent('time-block-service');

      const cancelBtn = await slice.build('Button', {
         value: 'Cancelar',
         variant: 'outlined',
         onClick: () => slice.events.emit('ui:modal:close')
      });
      const submitBtn = await slice.build('Button', {
         value: 'Guardar y Cerrar',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$actions.append(cancelBtn, submitBtn);

      this.$start.addEventListener('change', () => this.updateCapacity());
      this.$end.addEventListener('change', () => this.updateCapacity());
      this.updateCapacity();

      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });

      if (this.blockId) {
         this.loadBlock(this.blockId);
      }
   }

   loadBlock(blockId) {
      const block = this.timeBlockService?.getById(blockId);
      if (!block) {
         return;
      }

      this.$labelInput.value = block.label;
      this.$start.value = block.start;
      this.$end.value = block.end ?? block.start;
      this.$ruleSelect.value = block.rule ?? 'flexible';
      this.updateCapacity();
   }

   updateCapacity() {
      const start = this.$start.value;
      const end = this.$end.value;
      if (!start || !end) {
         return;
      }

      const duration = minutesBetween(start, end);
      const valid = duration >= 15;
      this.$capacity.value = String(duration);
      this.$error.hidden = valid;
      this.$end.setCustomValidity(valid ? '' : 'Hora de término inválida');
   }

   async handleSubmit() {
      this.timeBlockService = slice.getComponent('time-block-service');
      if (this._submitting || !this.timeBlockService) {
         return;
      }

      const start = this.$start.value;
      const end = this.$end.value;
      const duration = minutesBetween(start, end);
      if (duration < 15) {
         this.$error.hidden = false;
         return;
      }

      this._submitting = true;
      try {
         const payload = {
            label: this.$labelInput.value,
            start,
            end,
            rule: this.$ruleSelect.value
         };

         const saved = this.blockId
            ? await this.timeBlockService.update(this.blockId, payload)
            : await this.timeBlockService.create(payload);

         if (saved) {
            slice.events.emit('ui:modal:close');
         }
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-block-form', BlockForm);
