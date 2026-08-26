import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

export default class HabitForm extends HTMLElement {
   static props = {
      habitId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$name = this.querySelector('#habit-form-name');
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
         submitLabel: this.habitId ? 'Guardar cambios' : 'Guardar'
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
      this.$name.value = '';
      if (!this.habitId) {
         return;
      }
      const habitsService = getService('habits-service', ['getById']);
      const habit = habitsService?.getById(this.habitId);
      if (!habit) {
         showFormError(this.$error, 'No se encontró el hábito.');
         return;
      }
      this.$name.value = habit.name;
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const habitsService = getService('habits-service', ['create', 'update']);
      if (!habitsService) {
         showFormError(this.$error, 'Servicio de hábitos no disponible. Recarga la página.');
         return;
      }

      const name = this.$name.value.trim();
      if (!name) {
         showFormError(this.$error, 'Escribe un nombre.');
         this.$name.focus();
         return;
      }

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = this.habitId
            ? await habitsService.update(this.habitId, { name })
            : await habitsService.create({ name });

         if (saved) {
            closeModal();
            return;
         }

         showFormError(this.$error, 'No se pudo guardar el hábito.');
      } catch (error) {
         console.error('HabitForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-habit-form', HabitForm);
