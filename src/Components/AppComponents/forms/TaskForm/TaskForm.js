import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';
import { taskDateRange, todayISO } from '../../sections/plannerDates.js';

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
      this.$hint = this.querySelector('[data-role="hint"]');
      this.$titleInput = this.querySelector('#task-form-title');
      this.$urgencySelect = this.querySelector('#task-form-urgency');
      this.$minutesInput = this.querySelector('#task-form-minutes');
      this.$startInput = this.querySelector('#task-form-start');
      this.$dueInput = this.querySelector('#task-form-due');
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
      this._formBound = true;
   }

   populate() {
      hideFormError(this.$error);
      this.fillDomains();
      if (this.taskId) {
         this.loadTask(this.taskId);
      } else {
         this.$startInput.value = todayISO();
         this.$dueInput.value = '';
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

   loadTask(taskId) {
      const taskService = getService('task-service', ['getById']);
      const task = taskService?.getById(taskId);
      if (!task) {
         showFormError(this.$error, 'No se encontró la tarea.');
         return;
      }

      this.$titleInput.value = task.title;
      this.$urgencySelect.value = task.urgency ?? 'medium';
      this.$minutesInput.value = String(task.minutes ?? 30);
      this.$domainSelect.value = task.domainId;
      const { start, end } = taskDateRange(task);
      this.$startInput.value = start ?? '';
      this.$dueInput.value = end ?? '';
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const taskService = getService('task-service', ['create', 'update']);
      if (!taskService) {
         showFormError(this.$error, 'Servicio de tareas no disponible. Recarga la página.');
         return;
      }

      const title = this.$titleInput.value.trim();
      const domainId = this.$domainSelect.value;
      if (!title) {
         showFormError(this.$error, 'Ingresa un título para la tarea.');
         return;
      }
      if (!domainId) {
         showFormError(this.$error, 'Crea un dominio antes de guardar la tarea.');
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
         minutes: this.$minutesInput.value,
         startDate: startDate || (dueDate ? dueDate : todayISO()),
         dueDate
      };

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = this.taskId
            ? await taskService.update(this.taskId, payload)
            : await taskService.create(payload);

         if (saved) {
            closeModal();
            return;
         }

         showFormError(this.$error, 'No se pudo guardar la tarea. Revisa los datos.');
      } catch (error) {
         console.error('TaskForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-task-form', TaskForm);
