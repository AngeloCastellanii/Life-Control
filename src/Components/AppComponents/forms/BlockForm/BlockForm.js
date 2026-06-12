import { BLOCK_RULE } from '../../sections/lifeControlConstants.js';
import { closeModal, getService } from '../formHelpers.js';

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
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      await this.ensureButtons();
      this.bindForm();
      this.populate();
   }

   async update() {
      await this.ensureButtons();
      this.populate();
   }

   async ensureButtons() {
      if (this._buttonsReady && this.$actions.childElementCount >= 2) {
         return;
      }

      this.$actions.innerHTML = '';
      const cancelBtn = await slice.build('Button', {
         sliceId: `${this.sliceId}-cancel`,
         value: 'Cancelar',
         variant: 'outlined',
         onClick: () => closeModal()
      });
      const submitBtn = await slice.build('Button', {
         sliceId: `${this.sliceId}-submit`,
         value: this.blockId ? 'Guardar cambios' : 'Guardar y Cerrar',
         variant: 'filled',
         onClick: () => this.$form.requestSubmit()
      });
      this.$actions.append(cancelBtn, submitBtn);
      this._buttonsReady = true;
   }

   bindForm() {
      if (this._formBound) {
         return;
      }

      this.$start.addEventListener('change', () => this.updateCapacity());
      this.$end.addEventListener('change', () => this.updateCapacity());
      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });
      this._formBound = true;
   }

   getTimeBlockService() {
      return getService('time-block-service', ['getAll', 'create', 'update']);
   }

   findBlock(blockId) {
      const service = this.getTimeBlockService();
      const fromService = service?.getById?.(blockId);
      if (fromService) {
         return fromService;
      }

      const blocks = slice.context.getState('lifeControl')?.timeBlocks ?? [];
      return blocks.find((block) => block.id === blockId) ?? null;
   }

   resetForCreate() {
      this.$form.reset();
      this.$start.value = '08:00';
      this.$end.value = '10:00';
      this.$ruleSelect.value = BLOCK_RULE.FLEXIBLE;
      this.$error.hidden = true;
      this.updateCapacity();
   }

   populate() {
      this.timeBlockService = this.getTimeBlockService();

      if (this.blockId) {
         this.loadBlock(this.blockId);
         return;
      }

      this.resetForCreate();
   }

   loadBlock(blockId) {
      const block = this.findBlock(blockId);
      if (!block) {
         this.showError('No se encontró el bloque.');
         return;
      }

      this.$labelInput.value = block.label ?? '';
      this.$start.value = block.start ?? '08:00';
      this.$end.value = block.end ?? block.start ?? '10:00';
      this.$ruleSelect.value = block.rule ?? BLOCK_RULE.FLEXIBLE;
      this.$error.hidden = true;
      this.updateCapacity();
   }

   showError(message) {
      this.$error.textContent = message;
      this.$error.hidden = false;
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
      if (valid) {
         this.$error.hidden = true;
      }
      this.$end.setCustomValidity(valid ? '' : 'Hora de término inválida');
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      this.timeBlockService = this.getTimeBlockService();
      if (!this.timeBlockService) {
         this.showError('Servicio de bloques no disponible. Recarga la página.');
         return;
      }

      const label = this.$labelInput.value.trim();
      if (!label) {
         this.showError('Ingresa un nombre para el bloque.');
         return;
      }

      const start = this.$start.value;
      const end = this.$end.value;
      const duration = minutesBetween(start, end);
      if (duration < 15) {
         this.showError('La hora de término debe ser posterior a la de inicio (mín. 15 min).');
         return;
      }

      this._submitting = true;
      try {
         const payload = {
            label,
            start,
            end,
            rule: this.$ruleSelect.value
         };

         const saved = this.blockId
            ? await this.timeBlockService.update(this.blockId, payload)
            : await this.timeBlockService.create(payload);

         if (saved) {
            closeModal();
            return;
         }

         this.showError('No se pudo guardar el bloque. Revisa los datos e intenta de nuevo.');
      } catch (error) {
         console.error('BlockForm submit error:', error);
         this.showError('Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-block-form', BlockForm);
