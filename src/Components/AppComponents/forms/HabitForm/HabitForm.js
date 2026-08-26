import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

const COLORS = ['#3f7359', '#2563eb', '#c41e5a', '#d97706', '#7c3aed', '#0891b2'];
const WEEKDAYS = [
   { id: 1, label: 'L' },
   { id: 2, label: 'M' },
   { id: 3, label: 'X' },
   { id: 4, label: 'J' },
   { id: 5, label: 'V' },
   { id: 6, label: 'S' },
   { id: 0, label: 'D' }
];

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
      this.$notes = this.querySelector('#habit-form-notes');
      this.$frequency = this.querySelector('[data-role="frequency"]');
      this.$weekdaysWrap = this.querySelector('[data-role="weekdays-wrap"]');
      this.$weekdays = this.querySelector('[data-role="weekdays"]');
      this.$targetWrap = this.querySelector('[data-role="target-wrap"]');
      this.$target = this.querySelector('#habit-form-target');
      this.$remind = this.querySelector('#habit-form-remind');
      this.$colors = this.querySelector('[data-role="colors"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._buttonsReady = false;
      this._color = COLORS[0];
      this._days = new Set([1, 2, 3, 4, 5]);
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.renderWeekdays();
      this.renderColors();
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
      this.$frequency.addEventListener('change', () => this.syncFrequencyUi());
      this._formBound = true;
   }

   renderWeekdays() {
      this.$weekdays.innerHTML = '';
      for (const day of WEEKDAYS) {
         const btn = document.createElement('button');
         btn.type = 'button';
         btn.className = 'habit-form__day';
         btn.textContent = day.label;
         btn.classList.toggle('habit-form__day--on', this._days.has(day.id));
         btn.addEventListener('click', () => {
            if (this._days.has(day.id)) {
               this._days.delete(day.id);
            } else {
               this._days.add(day.id);
            }
            btn.classList.toggle('habit-form__day--on', this._days.has(day.id));
         });
         this.$weekdays.appendChild(btn);
      }
   }

   renderColors() {
      this.$colors.innerHTML = '';
      for (const color of COLORS) {
         const btn = document.createElement('button');
         btn.type = 'button';
         btn.className = 'habit-form__color';
         btn.style.background = color;
         btn.classList.toggle('habit-form__color--on', color === this._color);
         btn.setAttribute('aria-label', `Color ${color}`);
         btn.addEventListener('click', () => {
            this._color = color;
            this.renderColors();
         });
         this.$colors.appendChild(btn);
      }
   }

   syncFrequencyUi() {
      const value = this.$frequency.value;
      this.$weekdaysWrap.hidden = value !== 'custom';
      this.$targetWrap.hidden = value !== 'weekly';
   }

   populate() {
      hideFormError(this.$error);
      this.$name.value = '';
      this.$notes.value = '';
      this.$frequency.value = 'daily';
      this.$target.value = '4';
      this.$remind.value = '';
      this._color = COLORS[0];
      this._days = new Set([1, 2, 3, 4, 5]);
      if (this.habitId) {
         const habitsService = getService('habits-service', ['getById']);
         const habit = habitsService?.getById(this.habitId);
         if (!habit) {
            showFormError(this.$error, 'No se encontró el hábito.');
            return;
         }
         this.$name.value = habit.name;
         this.$notes.value = habit.notes ?? '';
         this.$frequency.value = habit.frequency || 'daily';
         this.$target.value = String(habit.weeklyTarget || 4);
         this.$remind.value = habit.remindAt || '';
         this._color = habit.color || COLORS[0];
         this._days = new Set(habit.weekdays?.length ? habit.weekdays : [1, 2, 3, 4, 5]);
      }
      this.renderWeekdays();
      this.renderColors();
      this.syncFrequencyUi();
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
      const payload = {
         name,
         notes: this.$notes.value.trim(),
         frequency: this.$frequency.value,
         weekdays: [...this._days],
         weeklyTarget: Number(this.$target.value) || 4,
         remindAt: this.$remind.value || '',
         color: this._color
      };
      try {
         const saved = this.habitId
            ? await habitsService.update(this.habitId, payload)
            : await habitsService.create(payload);

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
