const STORAGE_KEY = 'lc_onboarded';

const THEME_OPTIONS = [
   { id: 'Light', label: 'Claro', bg: '#dbeafe', fg: '#0f172a', accent: '#2563eb' },
   { id: 'Dark', label: 'Oscuro', bg: '#070b14', fg: '#fafafa', accent: '#3b82f6' },
   { id: 'DarkRed', label: 'Dark Red', bg: '#0d0609', fg: '#fafafa', accent: '#c41e5a' },
   { id: 'Slice', label: 'Slice', bg: '#b7cec0', fg: '#171717', accent: '#3f7359' },
   { id: 'Obsidian', label: 'Obsidiana', bg: '#0b0f19', fg: '#e2e8f0', accent: '#22d3ee' }
];

const STEPS = [
   {
      title: 'Bienvenido a Life Control',
      text: 'Tu vida organizada en un solo lugar: tareas, tiempo, finanzas, compras, notas y metas. Todo se guarda en tu dispositivo.',
      askName: true
   },
   {
      title: 'Elige tu tema',
      text: 'Escoge el estilo que más te guste. Puedes cambiarlo cuando quieras desde Perfil.',
      chooseTheme: true
   },
   {
      title: 'Dashboard',
      text: 'Tu resumen del día: capacidad, lo que vence hoy, finanzas y tus prioridades de un vistazo.'
   },
   {
      title: 'Planificador',
      text: 'Organiza tus tareas en bloques de tiempo (mañana, tarde, noche). Márcalas por urgencia y hazlas recurrentes para que se repitan solas.'
   },
   {
      title: 'Finanzas',
      text: 'Registra pagos y cobros pendientes, controla tu saldo y consulta el cambio del día en tu moneda (Bs, € o US$).'
   },
   {
      title: 'Compras',
      text: 'Tu lista de compras con cantidades, precios y fechas. Lo próximo a vencer aparece también en el Dashboard.'
   },
   {
      title: 'Notas y recordatorios',
      text: 'Guarda notas rápidas y ponles un recordatorio con notificación para que no se te olvide nada importante.'
   },
   {
      title: 'Modo enfoque',
      text: 'Muestra solo el bloque de tiempo actual y sus tareas, para que te concentres en lo de ahora mismo.'
   },
   {
      title: 'Estadísticas',
      text: 'Tu progreso: tareas completadas, pendientes por urgencia y el avance de tus presupuestos por dominio.'
   },
   {
      title: 'Vision Board',
      text: 'Un tablero visual con tus metas e imágenes que te inspiran a seguir adelante.'
   },
   {
      title: 'Perfil',
      text: 'Aquí ajustas tu nombre, el tema, los dominios (áreas de tu vida), la moneda, las notificaciones y el respaldo de tus datos.'
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
      this.$step.textContent = `${this._index + 1} / ${STEPS.length}`;
      this.$title.textContent = step.title;
      this.$text.textContent = step.text;

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
