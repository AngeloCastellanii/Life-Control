import { parseISO, todayISO } from '../plannerDates.js';
import { habitStreak, lastDays } from '../../../Service/HabitsService/HabitsService.js';

const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function weekdayLetter(iso) {
   return WEEKDAY[parseISO(iso).getDay()] ?? '';
}

export default class HabitsSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'habits-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$list = this.querySelector('[data-role="list"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.habitsService = slice.getComponent('habits-service');
      if (!this.habitsService) {
         slice.logger?.logError?.('HabitsSection', 'HabitsService no disponible');
         return;
      }

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderList(),
         (state) => ({ habits: state?.habits ?? [] })
      );

      this.renderList();
   }

   openEdit(habitId) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar hábito',
         form: 'HabitForm',
         habitId
      });
   }

   renderList() {
      const habits = this.habitsService.getAll();
      this.$list.innerHTML = '';
      this.$empty.hidden = habits.length > 0;

      const today = todayISO();
      const days = lastDays(7, today);

      for (const habit of habits) {
         const done = new Set(habit.doneDates);
         const todayDone = done.has(today);
         const streak = habitStreak(habit.doneDates, today);

         const item = document.createElement('li');
         item.className = 'habits-section__item lc-card';
         if (todayDone) {
            item.classList.add('habits-section__item--done');
         }

         const row = document.createElement('div');
         row.className = 'habits-section__row';

         const check = document.createElement('button');
         check.type = 'button';
         check.className = 'habits-section__check';
         check.classList.toggle('habits-section__check--on', todayDone);
         check.setAttribute('aria-pressed', todayDone ? 'true' : 'false');
         check.setAttribute('aria-label', todayDone ? `Desmarcar ${habit.name} hoy` : `Marcar ${habit.name} hoy`);
         check.textContent = todayDone ? '✓' : '';
         check.addEventListener('click', () => this.habitsService.toggleDate(habit.id, today));

         const name = document.createElement('span');
         name.className = 'habits-section__name';
         name.textContent = habit.name;

         const streakEl = document.createElement('span');
         streakEl.className = 'habits-section__streak';
         streakEl.textContent = streak ? `${streak}d` : '—';
         streakEl.title = streak ? `Racha de ${streak} día${streak === 1 ? '' : 's'}` : 'Sin racha';

         row.append(check, name, streakEl);

         const strip = document.createElement('div');
         strip.className = 'habits-section__days';
         strip.setAttribute('role', 'group');
         strip.setAttribute('aria-label', `Últimos 7 días de ${habit.name}`);

         for (const day of days) {
            const on = done.has(day);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'habits-section__day';
            btn.classList.toggle('habits-section__day--on', on);
            btn.classList.toggle('habits-section__day--today', day === today);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.setAttribute('aria-label', `${weekdayLetter(day)} ${day}${on ? ', hecho' : ''}`);
            btn.textContent = weekdayLetter(day);
            btn.addEventListener('click', () => this.habitsService.toggleDate(habit.id, day));
            strip.appendChild(btn);
         }

         const actions = document.createElement('div');
         actions.className = 'habits-section__actions';

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'habits-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.addEventListener('click', () => this.openEdit(habit.id));

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'habits-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar este hábito? Se pierde la racha.')) {
               this.habitsService.remove(habit.id);
            }
         });

         actions.append(editBtn, deleteBtn);
         item.append(row, strip, actions);
         this.$list.appendChild(item);
      }
   }
}

customElements.define('slice-habits-section', HabitsSection);
