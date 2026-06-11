import { getService } from '../../forms/formHelpers.js';
import { greetingForName } from '../profileGreeting.js';

export default class SettingsSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'settings-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$nameInput = this.querySelector('#settings-display-name');
      this.$saveName = this.querySelector('[data-role="save-name"]');
      this.$greetingPreview = this.querySelector('[data-role="greeting-preview"]');
      this.$saveStatus = this.querySelector('[data-role="save-status"]');
      this.$themeMount = this.querySelector('[data-role="theme-mount"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      const themeSelector = await slice.build('ThemeSelector', {
         sliceId: 'settings-theme-selector'
      });
      if (themeSelector) {
         this.$themeMount.appendChild(themeSelector);
      }

      this.$saveName.addEventListener('click', () => this.saveName());
      this.$nameInput.addEventListener('input', () => this.updatePreview());
      this.$nameInput.addEventListener('keydown', (event) => {
         if (event.key === 'Enter') {
            event.preventDefault();
            this.saveName();
         }
      });

      slice.context.watch(
         'lifeControl',
         this,
         (profile) => this.syncForm(profile),
         (state) => state?.profile ?? { displayName: '' }
      );

      this.syncForm(slice.context.getState('lifeControl')?.profile ?? { displayName: '' });
   }

   async update() {
      const themeSelector = slice.getComponent('settings-theme-selector');
      if (themeSelector?.syncSelect) {
         themeSelector.syncSelect();
      }
      this.syncForm(slice.context.getState('lifeControl')?.profile ?? { displayName: '' });
   }

   syncForm(profile) {
      const name = profile?.displayName ?? '';
      if (document.activeElement !== this.$nameInput) {
         this.$nameInput.value = name;
      }
      this.updatePreview(name);
   }

   updatePreview(name = this.$nameInput.value) {
      this.$greetingPreview.textContent = `Vista previa: «${greetingForName(name)}»`;
   }

   showStatus(message, isError = false) {
      this.$saveStatus.textContent = message;
      this.$saveStatus.hidden = false;
      this.$saveStatus.classList.toggle('settings-section__status--error', isError);
   }

   async saveName() {
      const profileService = getService('profile-service', ['setDisplayName']);
      if (!profileService) {
         this.showStatus('Servicio no disponible. Recarga la página.', true);
         return;
      }

      try {
         await profileService.setDisplayName(this.$nameInput.value);
         this.showStatus('Nombre guardado.');
      } catch (error) {
         console.error('SettingsSection saveName:', error);
         this.showStatus('No se pudo guardar. Intenta de nuevo.', true);
      }
   }
}

customElements.define('slice-settings-section', SettingsSection);
