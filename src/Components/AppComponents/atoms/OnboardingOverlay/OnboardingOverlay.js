const STORAGE_KEY = 'lc_onboarded';

const THEME_OPTIONS = [
   { id: 'Light', label: 'Claro', bg: '#eef6ff', fg: '#0f172a', accent: '#2563eb' },
   { id: 'Dark', label: 'Oscuro', bg: '#09090b', fg: '#fafafa', accent: '#3b82f6' },
   { id: 'Pink', label: 'Rosa', bg: '#fff1f5', fg: '#3f1d2e', accent: '#db2777' },
   { id: 'Purple', label: 'Morado', bg: '#f5f3ff', fg: '#2e1065', accent: '#7c3aed' },
   { id: 'Slice', label: 'Verde', bg: '#b7cec0', fg: '#171717', accent: '#3f7359' },
   { id: 'Obsidian', label: 'Obsidiana', bg: '#0b0f19', fg: '#e2e8f0', accent: '#22d3ee' }
];

const STEPS = [
   {
      kicker: 'Life Control',
      title: 'Tu día, en un solo lugar',
      text: 'Tareas, dinero, compras, notas y hábitos. Todo queda en este dispositivo.',
      askName: true
   },
   {
      kicker: 'Estilo',
      title: 'Elige un tema',
      text: 'Lo cambias después en Perfil.',
      chooseTheme: true
   },
   {
      kicker: 'Cómo se usa',
      title: 'Tres gestos',
      points: ['+ crea lo que necesites', 'Enfoque deja solo lo de ahora', 'Perfil guarda nombre, avisos y respaldo']
   }
];

export function shouldShowOnboarding() {
   try {
      return localStorage.getItem(STORAGE_KEY) !== 'done';
   } catch {
      return false;
   }
}

export default class OnboardingOverlay extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'onboarding-overlay' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$root = this.querySelector('[data-role="root"]');
      this.$dots = this.querySelector('[data-role="dots"]');
      this.$step = this.querySelector('[data-role="step-indicator"]');
      this.$title = this.querySelector('[data-role="title"]');
      this.$text = this.querySelector('[data-role="text"]');
      this.$points = this.querySelector('[data-role="points"]');
      this.$nameField = this.querySelector('[data-role="name-field"]');
      this.$nameInput = this.querySelector('[data-role="name-input"]');
      this.$themeField = this.querySelector('[data-role="theme-field"]');
      this.$next = this.querySelector('[data-role="next"]');
      this.$back = this.querySelector('[data-role="back"]');
      this.$skip = this.querySelector('[data-role="skip"]');
      this._index = 0;
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.$next.addEventListener('click', () => this.advance());
      this.$back.addEventListener('click', () => this.goBack());
      this.$skip.addEventListener('click', () => this.finish());
      this.buildDots();
      this.buildThemeOptions();
      this.renderStep();
      this.open();
   }

   open() {
      this.$root.hidden = false;
   }

   buildDots() {
      this.$dots.innerHTML = '';
      this._dotEls = STEPS.map(() => {
         const dot = document.createElement('span');
         dot.className = 'onboarding__dot';
         this.$dots.appendChild(dot);
         return dot;
      });
   }

   buildThemeOptions() {
      this.$themeField.innerHTML = '';
      this._themeButtons = THEME_OPTIONS.map((theme) => {
         const button = document.createElement('button');
         button.type = 'button';
         button.className = 'onboarding__theme';
         button.dataset.theme = theme.id;
         button.style.setProperty('--onb-bg', theme.bg);
         button.style.setProperty('--onb-fg', theme.fg);
         button.style.setProperty('--onb-accent', theme.accent);

         const preview = document.createElement('span');
         preview.className = 'onboarding__theme-preview';
         const chip = document.createElement('span');
         chip.className = 'onboarding__theme-chip';
         preview.appendChild(chip);

         const label = document.createElement('span');
         label.className = 'onboarding__theme-label';
         label.textContent = theme.label;

         button.append(preview, label);
         button.addEventListener('click', () => this.selectTheme(theme.id));
         this.$themeField.appendChild(button);
         return button;
      });
   }

   async selectTheme(themeId) {
      try {
         localStorage.setItem('sliceTheme', themeId);
         await slice.setTheme(themeId);
         slice.events.emit('theme:changed', { theme: themeId });
      } catch {
         /* ignore */
      }
      this.syncThemeActive();
   }

   syncThemeActive() {
      const current = slice.theme;
      for (const button of this._themeButtons ?? []) {
         button.classList.toggle('onboarding__theme--active', button.dataset.theme === current);
      }
   }

   renderStep() {
      const step = STEPS[this._index];
      this.$step.textContent = step.kicker || '';
      this.$title.textContent = step.title;
      this.$text.textContent = step.text || '';
      this.$text.hidden = !step.text;

      this.$points.innerHTML = '';
      this.$points.hidden = !step.points;
      for (const point of step.points ?? []) {
         const li = document.createElement('li');
         li.textContent = point;
         this.$points.appendChild(li);
      }

      this.$nameField.hidden = !step.askName;
      this.$themeField.hidden = !step.chooseTheme;

      if (step.askName) {
         const current = slice.getComponent('profile-service')?.getDisplayName?.() ?? '';
         this.$nameInput.value = current;
      }
      if (step.chooseTheme) {
         this.syncThemeActive();
      }

      this.$back.hidden = this._index === 0;
      this.$next.textContent = this._index === STEPS.length - 1 ? 'Comenzar' : 'Siguiente';

      (this._dotEls ?? []).forEach((dot, index) => {
         dot.classList.toggle('onboarding__dot--active', index === this._index);
         dot.classList.toggle('onboarding__dot--done', index < this._index);
      });
   }

   async persistName() {
      const step = STEPS[this._index];
      if (!step.askName) {
         return;
      }
      const name = this.$nameInput.value.trim();
      if (name) {
         await slice.getComponent('profile-service')?.setDisplayName?.(name);
      }
   }

   async advance() {
      await this.persistName();
      if (this._index < STEPS.length - 1) {
         this._index += 1;
         this.renderStep();
         return;
      }
      this.finish();
   }

   goBack() {
      if (this._index > 0) {
         this._index -= 1;
         this.renderStep();
      }
   }

   finish() {
      try {
         localStorage.setItem(STORAGE_KEY, 'done');
      } catch {
         /* ignore */
      }
      this.$root.hidden = true;
      slice.controller.destroyComponent(this.sliceId);
      this.remove();
   }
}

customElements.define('slice-onboarding-overlay', OnboardingOverlay);
