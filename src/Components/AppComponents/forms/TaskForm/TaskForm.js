import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';
import { taskDateRange, todayISO } from '../../sections/plannerDates.js';
import {
   blockNeedsSlotPicker,
   defaultSlotForBlock,
   slotDurationMinutes,
   validateTaskSlot
} from '../../../Utils/taskSlotTimes.js';
import { addMinutes } from '../../../Service/TimeBlockService/TimeBlockService.js';

export default class TaskForm extends HTMLElement {
   static props = {
      taskId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$domainSelect = this.querySelector('#task-form-domain');
      this.$blockSelect = this.querySelector('#task-form-block');
      this.$hint = this.querySelector('[data-role="hint"]');
      this.$titleInput = this.querySelector('#task-form-title');
      this.$urgencySelect = this.querySelector('#task-form-urgency');
      this.$minutesInput = this.querySelector('#task-form-minutes');
      this.$startInput = this.querySelector('#task-form-start');
      this.$dueInput = this.querySelector('#task-form-due');
      this.$slotSection = this.querySelector('[data-role="slot-section"]');
      this.$slotHint = this.querySelector('[data-role="slot-hint"]');
      this.$slotStart = this.querySelector('#task-form-slot-start');
      this.$slotEnd = this.querySelector('#task-form-slot-end');
      this.$error = this.querySelector('[data-role="error"]');
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
      await buildModalButtons(this, {
         submitLabel: this.taskId ? 'Guardar cambios' : 'Guardar'
      });
      this._buttonsReady = true;
   }

   bindForm() {
      if (this._formBound) {
         return;
      }
      this.$form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.handleSubmit();
      });
      this.$blockSelect.addEventListener('change', () => this.onBlockChange());
      this.$minutesInput.addEventListener('input', () => this.syncSlotEndFromDuration());
      this.$slotStart.addEventListener('change', () => this.syncMinutesFromSlot());
      this.$slotEnd.addEventListener('change', () => this.syncMinutesFromSlot());
      this._formBound = true;
   }

   populate() {
      hideFormError(this.$error);
      this.fillDomains();
      this.fillBlocks();
      if (this.taskId) {
         this.loadTask(this.taskId);
      } else {
         this.$startInput.value = todayISO();
         this.$dueInput.value = '';
         this.$blockSelect.value = '';
         this.$slotStart.value = '';
         this.$slotEnd.value = '';
         this.updateSlotFieldsVisibility();
      }
   }

   fillDomains() {
      const domainService = getService('domain-service', ['getAll']);
      const domains = domainService?.getAll() ?? [];
      this.$domainSelect.innerHTML = '';

      if (domains.length === 0) {
         this.$hint.hidden = false;
         this.$domainSelect.disabled = true;
         return;
      }

      this.$hint.hidden = true;
      this.$domainSelect.disabled = false;
      for (const domain of domains) {
         const option = document.createElement('option');
         option.value = domain.id;
         option.textContent = domain.name;
         this.$domainSelect.appendChild(option);
      }
   }

   fillBlocks() {
      const timeBlockService = getService('time-block-service', ['getAll', 'acceptsTasks']);
      const blocks = timeBlockService?.getAll?.() ?? [];
      this.$blockSelect.innerHTML = '';

      const inboxOption = document.createElement('option');
      inboxOption.value = '';
      inboxOption.textContent = 'Inbox (sin bloque)';
      this.$blockSelect.appendChild(inboxOption);

      for (const block of blocks) {
         if (timeBlockService?.acceptsTasks?.(block) === false) {
            continue;
         }
         const option = document.createElement('option');
         option.value = block.id;
         option.textContent = block.label;
         this.$blockSelect.appendChild(option);
      }

      this.$blockSelect.disabled = this.$blockSelect.options.length <= 1;
   }

   getSelectedBlock() {
      const blockId = this.$blockSelect.value;
      if (!blockId) {
         return null;
      }
      const timeBlockService = getService('time-block-service', ['getById']);
      return timeBlockService?.getById?.(blockId) ?? null;
   }

   applySlotConstraints(block) {
      if (!block?.start) {
         return;
      }
      const blockEnd = block.end ?? block.start;
      this.$slotStart.min = block.start;
      this.$slotStart.max = blockEnd;
      this.$slotEnd.min = block.start;
      this.$slotEnd.max = blockEnd;
      if (this.$slotHint) {
         this.$slotHint.textContent = `Dentro de ${block.start} — ${blockEnd}.`;
      }
   }

   updateSlotFieldsVisibility() {
      const block = this.getSelectedBlock();
      const needs = block && blockNeedsSlotPicker(block);
      this.$slotSection.hidden = !needs;
      if (needs) {
         this.applySlotConstraints(block);
      }
   }

   onBlockChange() {
      const block = this.getSelectedBlock();
      this.updateSlotFieldsVisibility();
      if (!block || !blockNeedsSlotPicker(block)) {
         this.$slotStart.value = '';
         this.$slotEnd.value = '';
         return;
      }
      if (this._loadingTask) {
         return;
      }
      const { slotStart, slotEnd } = defaultSlotForBlock(block, this.$minutesInput.value);
      this.$slotStart.value = slotStart ?? '';
      this.$slotEnd.value = slotEnd ?? '';
   }

   syncSlotEndFromDuration() {
      if (this.$slotSection.hidden || !this.$slotStart.value) {
         return;
      }
      const block = this.getSelectedBlock();
      if (!block) {
         return;
      }
      const mins = Math.max(1, Number(this.$minutesInput.value) || 30);
      const nextEnd = addMinutes(this.$slotStart.value, mins);
      const blockEnd = block.end ?? block.start;
      this.$slotEnd.value = nextEnd <= blockEnd ? nextEnd : blockEnd;
   }

   syncMinutesFromSlot() {
      if (this.$slotSection.hidden) {
         return;
      }
      const duration = slotDurationMinutes(this.$slotStart.value, this.$slotEnd.value);
      if (duration && duration > 0) {
         this.$minutesInput.value = String(duration);
      }
   }

   resolveSlotForSubmit(block) {
      if (!block || !blockNeedsSlotPicker(block)) {
         return { ok: true, slotStart: null, slotEnd: null };
      }
      return validateTaskSlot({
         slotStart: this.$slotStart.value,
         slotEnd: this.$slotEnd.value,
         block
      });
   }

   loadTask(taskId) {
      const taskService = getService('task-service', ['getById']);
      const task = taskService?.getById(taskId);
      if (!task) {
         showFormError(this.$error, 'No se encontró la tarea.');
         return;
      }

      this._loadingTask = true;
      this.$titleInput.value = task.title;
      this.$urgencySelect.value = task.urgency ?? 'medium';
      this.$minutesInput.value = String(task.minutes ?? 30);
      this.$domainSelect.value = task.domainId;
      this.$blockSelect.value = task.blockId ?? '';
      this.$slotStart.value = task.slotStart ?? '';
      this.$slotEnd.value = task.slotEnd ?? '';
      const { start, end } = taskDateRange(task);
      this.$startInput.value = start ?? '';
      this.$dueInput.value = end ?? '';
      this.updateSlotFieldsVisibility();
      const block = this.getSelectedBlock();
      if (block && blockNeedsSlotPicker(block) && !task.slotStart) {
         const { slotStart, slotEnd } = defaultSlotForBlock(block, task.minutes);
         this.$slotStart.value = slotStart ?? '';
         this.$slotEnd.value = slotEnd ?? '';
      }
      this._loadingTask = false;
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const taskService = getService('task-service', ['create', 'update']);
      const timeBlockService = getService('time-block-service', ['assignTask', 'unassignTask']);
      if (!taskService) {
         showFormError(this.$error, 'Servicio de tareas no disponible. Recarga la página.');
         return;
      }

      const title = this.$titleInput.value.trim();
      const domainId = this.$domainSelect.value;
      const blockId = this.$blockSelect.value || null;
      const block = this.getSelectedBlock();
      if (!title) {
         showFormError(this.$error, 'Ingresa un título para la tarea.');
         return;
      }
      if (!domainId) {
         showFormError(this.$error, 'Crea un dominio antes de guardar la tarea.');
         return;
      }

      const slotResult = this.resolveSlotForSubmit(block);
      if (!slotResult.ok) {
         showFormError(this.$error, slotResult.message);
         return;
      }

      const startDate = this.$startInput.value || null;
      const dueDate = this.$dueInput.value || null;
      if (startDate && dueDate && startDate > dueDate) {
         showFormError(this.$error, 'La fecha tope no puede ser anterior al inicio.');
         return;
      }

      const payload = {
         title,
         domainId,
         urgency: this.$urgencySelect.value,
         minutes: slotResult.duration ?? this.$minutesInput.value,
         startDate: startDate || (dueDate ? dueDate : todayISO()),
         dueDate,
         slotStart: slotResult.slotStart,
         slotEnd: slotResult.slotEnd
      };

      this._submitting = true;
      hideFormError(this.$error);
      try {
         if (this.taskId) {
            const existing = taskService.getById(this.taskId);
            const saved = await taskService.update(this.taskId, payload);
            if (!saved) {
               showFormError(this.$error, 'No se pudo guardar la tarea. Revisa los datos.');
               return;
            }

            if (timeBlockService) {
               const previousBlock = existing?.blockId ?? null;
               if (blockId && blockId !== previousBlock) {
                  await timeBlockService.assignTask(blockId, this.taskId);
                  if (slotResult.slotStart && slotResult.slotEnd) {
                     await taskService.update(this.taskId, {
                        slotStart: slotResult.slotStart,
                        slotEnd: slotResult.slotEnd,
                        minutes: slotResult.duration ?? payload.minutes
                     });
                  }
               } else if (!blockId && previousBlock) {
                  await timeBlockService.unassignTask(previousBlock, this.taskId);
               }
            }

            closeModal();
            return;
         }

         const saved = await taskService.create(payload);
         if (!saved) {
            showFormError(this.$error, 'No se pudo guardar la tarea. Revisa los datos.');
            return;
         }

         if (blockId && timeBlockService) {
            await timeBlockService.assignTask(blockId, saved.id);
            if (slotResult.slotStart && slotResult.slotEnd) {
               await taskService.update(saved.id, {
                  slotStart: slotResult.slotStart,
                  slotEnd: slotResult.slotEnd,
                  minutes: slotResult.duration ?? payload.minutes
               });
            }
         }

         closeModal();
      } catch (error) {
         console.error('TaskForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-task-form', TaskForm);
