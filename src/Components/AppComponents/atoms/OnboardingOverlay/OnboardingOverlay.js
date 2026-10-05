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
      text: 'Tareas, tiempo, dinero, compras, notas, hábitos y metas. Todo se guarda en este dispositivo.',
      askName: true
   },
   {
      kicker: 'Estilo',
      title: 'Elige un tema',
      text: 'Claro, oscuro, rosa, morado o verde. Lo cambias cuando quieras desde Perfil.',
      chooseTheme: true
   },
   {
      kicker: 'Inicio',
      title: 'Dashboard',
      text: 'Lo primero son las tareas de hoy. Más abajo, finanzas y compras por separado, el Vision Board y las estadísticas, que se pliegan.'
   },
   {
      kicker: 'Tiempo',
      title: 'Planificador',
      text: 'Las tareas viven en bloques (mañana, tarde, noche). La urgencia las ordena. Si se repiten, al completarlas aparece la siguiente.'
   },
   {
      kicker: 'Dinero',
      title: 'Finanzas',
      text: 'Cada método (Zelle, efectivo, banco) tiene su saldo. El fondo total es la suma. “Fondo para repartir” es opcional: si lo marcas en un método, al crear otro se puede descontar primero de ese saldo.'
   },
   {
      kicker: 'Compras',
      title: 'Compras',
      text: 'Artículos con frecuencia, precio y fecha. Al marcar uno como comprado, se registra el egreso en Finanzas.'
   },
   {
      kicker: 'Notas',
      title: 'Notas y listas',
      text: 'Texto o lista. En una lista, toca el texto para editarlo. Fija las importantes, archiva las terminadas y pon un aviso a una hora.'
   },
   {
      kicker: 'Constancia',
      title: 'Hábitos',
      text: 'Frecuencia, meta de la semana y racha. El botón Enfoque, dentro de Hábitos, deja solo lo que toca hoy.'
   },
   {
      kicker: 'Ahora',
      title: 'Enfoque',
      text: 'El botón flotante abre el bloque en el que estás. Marca la tarea y sal cuando termines. En Hábitos muestra los de hoy.'
   },
   {
      kicker: 'Metas',
      title: 'Vision Board',
      text: 'Está en el inicio. Cada meta muestra la fecha a la izquierda y, a la derecha, cuántos días faltan.'
   },
   {
      kicker: 'Ajustes',
      title: 'Perfil',
      text: 'Nombre, tema, orden de las vistas, avisos del teléfono y una copia de tus datos para pasarlos a otro dispositivo.'
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
