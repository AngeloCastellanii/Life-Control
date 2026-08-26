import { parseISO, todayISO } from '../plannerDates.js';
import {
   bestStreak,
   habitStreak,
   isHabitDueOn,
   lastDays,
   monthGrid,
   weekProgress
} from '../../../Service/HabitsService/HabitsService.js';

const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function weekdayLetter(iso) {
   return WEEKDAY[parseISO(iso).getDay()] ?? '';
}

function frequencyLabel(habit) {
   if (habit.frequency === 'weekdays') {
      return 'L–V';
   }
   if (habit.frequency === 'custom') {
      return (habit.weekdays ?? []).map((day) => WEEKDAY[day]).join('');
   }
   if (habit.frequency === 'weekly') {
      return `${habit.weeklyTarget}×/sem`;
   }
   return 'Diario';
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
      this.$summary = this.querySelector('[data-role="summary"]');
      this._openMonth = null;
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

   renderSummary(habits) {
      const today = todayISO();
      const active = habits.filter((habit) => !habit.paused);
      const dueToday = active.filter((habit) => isHabitDueOn(habit, today));
      const doneToday = dueToday.filter((habit) => habit.doneDates.includes(today)).length;
      this.$summary.hidden = habits.length === 0;
      this.$summary.textContent = dueToday.length
         ? `Hoy ${doneToday}/${dueToday.length} · ${active.length} activo${active.length === 1 ? '' : 's'}`
         : `${active.length} hábito${active.length === 1 ? '' : 's'} activo${active.length === 1 ? '' : 's'}`;
   }

   renderList() {
      const habits = this.habitsService.getAll();
      this.$list.innerHTML = '';
      this.$empty.hidden = habits.length > 0;
      this.renderSummary(habits);

      const today = todayISO();
      const days = lastDays(7, today);

      for (const habit of habits) {
         const done = new Set(habit.doneDates);
         const skipped = new Set(habit.skippedDates);
         const todayDone = done.has(today);
         const streak = habitStreak(habit, today);
         const best = bestStreak(habit);
         const week = weekProgress(habit, today);
         const dueToday = isHabitDueOn(habit, today);

         const item = document.createElement('li');
         item.className = 'habits-section__item lc-card';
         item.style.setProperty('--habit-color', habit.color);
         if (todayDone) {
            item.classList.add('habits-section__item--done');
         }
         if (habit.paused) {
            item.classList.add('habits-section__item--paused');
         }

         const row = document.createElement('div');
         row.className = 'habits-section__row';

         const check = document.createElement('button');
         check.type = 'button';
         check.className = 'habits-section__check';
         check.classList.toggle('habits-section__check--on', todayDone);
         check.disabled = habit.paused || !dueToday;
         check.setAttribute('aria-pressed', todayDone ? 'true' : 'false');
         check.setAttribute('aria-label', todayDone ? `Desmarcar ${habit.name} hoy` : `Marcar ${habit.name} hoy`);
         check.textContent = todayDone ? '✓' : '';
         check.addEventListener('click', () => this.habitsService.toggleDate(habit.id, today));

         const text = document.createElement('div');
         text.className = 'habits-section__text';
         const name = document.createElement('span');
         name.className = 'habits-section__name';
         name.textContent = habit.name;
         const meta = document.createElement('span');
         meta.className = 'habits-section__meta';
         meta.textContent = [
            frequencyLabel(habit),
            `${week.done}/${week.target} sem`,
            habit.remindAt ? `⏰ ${habit.remindAt}` : null,
            habit.paused ? 'Pausado' : null
         ]
            .filter(Boolean)
            .join(' · ');
         text.append(name, meta);
         if (habit.notes) {
            const notes = document.createElement('p');
            notes.className = 'habits-section__notes';
            notes.textContent = habit.notes;
            text.appendChild(notes);
         }

         const streakEl = document.createElement('span');
         streakEl.className = 'habits-section__streak';
         streakEl.textContent = streak ? `${streak}d` : '—';
         streakEl.title = `Racha ${streak} · récord ${best}`;

         row.append(check, text, streakEl);

         const strip = document.createElement('div');
         strip.className = 'habits-section__days';
         strip.setAttribute('role', 'group');
         strip.setAttribute('aria-label', `Últimos 7 días de ${habit.name}`);

         for (const day of days) {
            const on = done.has(day);
            const skip = skipped.has(day);
            const due = isHabitDueOn({ ...habit, paused: false }, day);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'habits-section__day';
            btn.classList.toggle('habits-section__day--on', on);
            btn.classList.toggle('habits-section__day--skip', skip);
            btn.classList.toggle('habits-section__day--off', !due);
            btn.classList.toggle('habits-section__day--today', day === today);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.setAttribute('aria-label', `${weekdayLetter(day)} ${day}`);
            btn.textContent = weekdayLetter(day);
            btn.addEventListener('click', () => this.habitsService.toggleDate(habit.id, day));
            strip.appendChild(btn);
         }

         const monthWrap = document.createElement('div');
         monthWrap.className = 'habits-section__month';
         monthWrap.hidden = this._openMonth !== habit.id;
         if (this._openMonth === habit.id) {
            this.fillMonth(monthWrap, habit, done, skipped, today);
         }

         const actions = document.createElement('div');
         actions.className = 'habits-section__actions';

         const skipBtn = document.createElement('button');
         skipBtn.type = 'button';
         skipBtn.className = 'habits-section__edit';
         skipBtn.textContent = skipped.has(today) ? 'Quitar skip' : 'Saltar hoy';
         skipBtn.addEventListener('click', () => this.habitsService.skipDate(habit.id, today));

         const monthBtn = document.createElement('button');
         monthBtn.type = 'button';
         monthBtn.className = 'habits-section__edit';
         monthBtn.textContent = this._openMonth === habit.id ? 'Ocultar mes' : 'Calendario';
         monthBtn.addEventListener('click', () => {
            this._openMonth = this._openMonth === habit.id ? null : habit.id;
            this.renderList();
         });

         const pauseBtn = document.createElement('button');
         pauseBtn.type = 'button';
         pauseBtn.className = 'habits-section__edit';
         pauseBtn.textContent = habit.paused ? 'Reanudar' : 'Pausar';
         pauseBtn.addEventListener('click', () => this.habitsService.update(habit.id, { paused: !habit.paused }));

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
            if (confirm('¿Eliminar este hábito? Se pierde el historial.')) {
               this.habitsService.remove(habit.id);
            }
         });

         actions.append(skipBtn, monthBtn, pauseBtn, editBtn, deleteBtn);
         item.append(row, strip, monthWrap, actions);
         this.$list.appendChild(item);
      }
   }

   fillMonth(wrap, habit, done, skipped, today) {
      wrap.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'habits-section__month-grid';
      for (const letter of WEEKDAY) {
         const head = document.createElement('span');
         head.className = 'habits-section__month-head';
         head.textContent = letter;
         grid.appendChild(head);
      }
      for (const day of monthGrid(today)) {
         const cell = document.createElement('button');
         cell.type = 'button';
         cell.className = 'habits-section__month-cell';
         if (!day) {
            cell.disabled = true;
            cell.classList.add('habits-section__month-cell--empty');
            grid.appendChild(cell);
            continue;
         }
         cell.textContent = String(Number(day.slice(8)));
         cell.classList.toggle('habits-section__month-cell--on', done.has(day));
         cell.classList.toggle('habits-section__month-cell--skip', skipped.has(day));
         cell.classList.toggle('habits-section__month-cell--today', day === today);
         cell.addEventListener('click', () => this.habitsService.toggleDate(habit.id, day));
         grid.appendChild(cell);
      }
      wrap.appendChild(grid);
   }
}

customElements.define('slice-habits-section', HabitsSection);
