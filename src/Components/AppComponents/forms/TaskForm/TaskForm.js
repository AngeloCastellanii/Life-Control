import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';
import { addDays, taskDateRange, todayISO } from '../../sections/plannerDates.js';
import {
   blockNeedsSlotPicker,
   formatBlockRangeLabel,
   nextStackedSlotForBlock,
   slotDurationMinutes,
   slotEndFromStart,
   slotStartFromEnd,
   timeToMinutes,
   validateTaskSlot
} from '../../../Utils/taskSlotTimes.js';
import { minutesBetween } from '../../../Service/TimeBlockService/TimeBlockService.js';
import {
   durationToMinutes,
   minutesToDurationParts
} from '../../../Utils/formatDuration.js';

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
      this.$durationInput = this.querySelector('#task-form-duration');
      this.$durationUnit = this.querySelector('#task-form-duration-unit');
      this.$recurrenceSelect = this.querySelector('#task-form-recurrence');
      this.$startInput = this.querySelector('#task-form-start');
      this.$dueInput = this.querySelector('#task-form-due');
      this.$slotSection = this.querySelector('[data-role="slot-section"]');
      this.$slotHint = this.querySelector('[data-role="slot-hint"]');
      this.$slotStart = this.querySelector('#task-form-slot-start');
      this.$slotEnd = this.querySelector('#task-form-slot-end');
      this.$error = this.querySelector('[data-role="error"]');
      this._buttonsReady = false;
      this._syncingSlot = false;
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
      this.$durationInput.addEventListener('input', () => this.onDurationChange());
      this.$durationUnit.addEventListener('change', () => this.onDurationChange());
      this.$slotStart.addEventListener('change', () => this.onSlotStartChange());
      this.$slotEnd.addEventListener('change', () => this.onSlotEndChange());
      this._formBound = true;
   }

   getDurationMinutes() {
      return durationToMinutes(this.$durationInput.value, this.$durationUnit.value);
   }

   /**
    * Minutos usados solo para la franja del bloque.
    * Si la duración es en días, no se intenta meter días enteros en un solo bloque.
    */
   getSlotWorkMinutes(block = this.getSelectedBlock()) {
      if (this.$durationUnit.value === 'days') {
         const blockMins = block
            ? minutesBetween(block.start, block.end ?? block.start)
            : 60;
         const currentSlot = slotDurationMinutes(this.$slotStart?.value, this.$slotEnd?.value);
         if (currentSlot && currentSlot > 0) {
            return Math.min(currentSlot, blockMins);
         }
         return Math.min(60, Math.max(15, blockMins));
      }
      return this.getDurationMinutes();
   }

   setDurationFromMinutes(minutes) {
      const parts = minutesToDurationParts(minutes);
      this.$durationInput.value = String(parts.value);
      this.$durationUnit.value = parts.unit;
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
         this.$durationInput.value = '30';
         this.$durationUnit.value = 'minutes';
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
         option.textContent = `${block.label} (${formatBlockRangeLabel(block.start, block.end ?? block.start)})`;
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

   tasksInSelectedBlock(excludeTaskId = null) {
      const blockId = this.$blockSelect.value;
      if (!blockId) {
         return [];
      }
      const taskService = getService('task-service', ['getAll']);
      return (taskService?.getAll?.() ?? []).filter(
         (task) => task.blockId === blockId && task.id !== excludeTaskId
      );
   }

   stackedSlotForSelectedBlock() {
      const block = this.getSelectedBlock();
      if (!block) {
         return { slotStart: null, slotEnd: null };
      }
      return nextStackedSlotForBlock(
         block,
         this.getSlotWorkMinutes(block),
         this.tasksInSelectedBlock(this.taskId),
         this.taskId
      );
   }

   applySlotConstraints(block) {
      if (!block?.start) {
         return;
      }
      const blockEnd = block.end ?? block.start;
      const startMins = timeToMinutes(block.start);
      const endMins = timeToMinutes(blockEnd);
      const overnight = startMins !== null && endMins !== null && endMins <= startMins;

      // min/max nativos rompen bloques que cruzan medianoche (ej. 7:00 PM → 2:30 AM)
      for (const input of [this.$slotStart, this.$slotEnd]) {
         if (!input) {
            continue;
         }
         if (overnight) {
            input.removeAttribute('min');
            input.removeAttribute('max');
         } else {
            input.min = block.start;
            input.max = blockEnd;
         }
      }

      if (this.$slotHint) {
         this.$slotHint.textContent = overnight
            ? `Dentro de ${formatBlockRangeLabel(block.start, blockEnd)} (cruza medianoche). Se apilan solas si hay otras tareas.`
            : `Dentro de ${formatBlockRangeLabel(block.start, blockEnd)}. Se apilan solas si hay otras tareas.`;
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
      const { slotStart, slotEnd } = this.stackedSlotForSelectedBlock();
      this.$slotStart.value = slotStart ?? '';
      this.$slotEnd.value = slotEnd ?? '';
   }

   onDurationChange() {
      if (this.$durationUnit.value === 'days') {
         this.applyDaysSpanToDates();
      }
      // Recalcular franja con minutos de sesión (no días enteros)
      this.syncSlotEndFromDuration();
      this.ensureValidSlotOrRestack();
   }

   /** Si la franja quedó inválida (p. ej. al pasar a días), vuelve a apilar. */
   ensureValidSlotOrRestack() {
      if (this.$slotSection.hidden || this._loadingTask) {
         return;
      }
      const block = this.getSelectedBlock();
      if (!block || !blockNeedsSlotPicker(block)) {
         return;
      }
      if (!this.$slotStart.value || !this.$slotEnd.value) {
         const defaults = this.stackedSlotForSelectedBlock();
         this.$slotStart.value = defaults.slotStart ?? '';
         this.$slotEnd.value = defaults.slotEnd ?? '';
         return;
      }
      const check = validateTaskSlot({
         slotStart: this.$slotStart.value,
         slotEnd: this.$slotEnd.value,
         block
      });
      if (check.ok) {
         return;
      }
      const defaults = this.stackedSlotForSelectedBlock();
      this.$slotStart.value = defaults.slotStart ?? '';
      this.$slotEnd.value = defaults.slotEnd ?? '';
   }

   /** Con duración en días: rango desde → tope = N días (aparece cada día hasta completar). */
   applyDaysSpanToDates() {
      const days = Math.max(1, Math.ceil(Number(this.$durationInput.value) || 1));
      const start = this.$startInput.value || todayISO();
      if (!this.$startInput.value) {
         this.$startInput.value = start;
      }
      this.$dueInput.value = addDays(start, days - 1);
   }

   syncSlotEndFromDuration() {
      if (this._syncingSlot || this.$slotSection.hidden) {
         return;
      }
      const block = this.getSelectedBlock();
      if (!block) {
         return;
      }
      if (!this.$slotStart.value) {
         const defaults = this.stackedSlotForSelectedBlock();
         this.$slotStart.value = defaults.slotStart ?? '';
         this.$slotEnd.value = defaults.slotEnd ?? '';
         return;
      }
      this._syncingSlot = true;
      const end = slotEndFromStart(this.$slotStart.value, this.getSlotWorkMinutes(block), block);
      if (end) {
         this.$slotEnd.value = end;
      }
      this._syncingSlot = false;
   }

   onSlotStartChange() {
      if (this._syncingSlot || this.$slotSection.hidden) {
         return;
      }
      this.syncSlotEndFromDuration();
   }

   onSlotEndChange() {
      if (this._syncingSlot || this.$slotSection.hidden) {
         return;
      }
      const block = this.getSelectedBlock();
      if (!block || !this.$slotEnd.value) {
         return;
      }
      this._syncingSlot = true;
      const start = slotStartFromEnd(this.$slotEnd.value, this.getSlotWorkMinutes(block), block);
      if (start) {
         this.$slotStart.value = start;
      }
      this._syncingSlot = false;
   }

   resolveSlotForSubmit(block) {
      const storedMinutes = this.getDurationMinutes();
      if (!block || !blockNeedsSlotPicker(block)) {
         return { ok: true, slotStart: null, slotEnd: null, duration: storedMinutes };
      }
      if (!this.$slotStart.value || !this.$slotEnd.value) {
         const defaults = this.stackedSlotForSelectedBlock();
         this.$slotStart.value = defaults.slotStart ?? '';
         this.$slotEnd.value = defaults.slotEnd ?? '';
      }
      const result = validateTaskSlot({
         slotStart: this.$slotStart.value,
         slotEnd: this.$slotEnd.value,
         block
      });
      if (result.ok) {
         // En días: guardamos la duración total en días; la franja es solo la sesión del día.
         return { ...result, duration: storedMinutes };
      }
      return result;
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
      this.setDurationFromMinutes(task.minutes ?? 30);
      this.$recurrenceSelect.value = task.recurrence ?? 'none';
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
         const { slotStart, slotEnd } = this.stackedSlotForSelectedBlock();
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

      if (this.$durationUnit.value === 'days') {
         this.applyDaysSpanToDates();
      }

      const minutes = this.getDurationMinutes();
      const slotResult = this.resolveSlotForSubmit(block);
      if (!slotResult.ok) {
         showFormError(this.$error, slotResult.message);
         return;
      }

      let startDate = this.$startInput.value || null;
      let dueDate = this.$dueInput.value || null;
      if (this.$durationUnit.value === 'days') {
         const days = Math.max(1, Math.ceil(Number(this.$durationInput.value) || 1));
         startDate = startDate || todayISO();
         dueDate = addDays(startDate, days - 1);
      }
      if (startDate && dueDate && startDate > dueDate) {
         showFormError(this.$error, 'La fecha tope no puede ser anterior al inicio.');
         return;
      }

      const payload = {
         title,
         domainId,
         urgency: this.$urgencySelect.value,
         minutes,
         recurrence: this.$recurrenceSelect.value,
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
                        minutes
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
                  minutes
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
