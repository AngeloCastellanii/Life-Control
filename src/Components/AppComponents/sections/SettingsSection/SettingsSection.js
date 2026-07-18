import { clearAppCacheAndReload } from '../clearAppCache.js';
import {
   downloadJsonBackup,
   exportAppData,
   hasStoredData,
   importAppData,
   readBackupFile,
   summarizeBackup
} from '../dataBackup.js';
import {
   notificationPermission,
   notificationsSupported,
   requestNotificationPermission
} from '../notifications.js';
import { CURRENCIES, getPreferredCurrency, setPreferredCurrency } from '../currency.js';

export default class SettingsSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'settings-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$avatar = this.querySelector('[data-role="avatar"]');
      this.$nameInput = this.querySelector('#settings-display-name');
      this.$saveName = this.querySelector('[data-role="save-name"]');
      this.$saveStatus = this.querySelector('[data-role="save-status"]');
      this.$clearCache = this.querySelector('[data-role="clear-cache"]');
      this.$cacheStatus = this.querySelector('[data-role="cache-status"]');
      this.$exportData = this.querySelector('[data-role="export-data"]');
      this.$importData = this.querySelector('[data-role="import-data"]');
      this.$importFile = this.querySelector('[data-role="import-file"]');
      this.$enableNotifications = this.querySelector('[data-role="enable-notifications"]');
      this.$notifStatus = this.querySelector('[data-role="notif-status"]');
      this.$currencySelect = this.querySelector('[data-role="currency-select"]');
      this.$domainList = this.querySelector('[data-role="domain-list"]');
      this.$domainEmpty = this.querySelector('[data-role="domain-empty"]');
      this.$addDomain = this.querySelector('[data-role="add-domain"]');
      this.$backupStatus = this.querySelector('[data-role="backup-status"]');
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
      this.$clearCache.addEventListener('click', () => this.clearCache());
      this.$exportData.addEventListener('click', () => this.exportData());
      this.$importData.addEventListener('click', () => this.$importFile.click());
      this.$importFile.addEventListener('change', () => this.importData());
      this.$enableNotifications.addEventListener('click', () => this.enableNotifications());
      this.syncNotificationState();
      this.setupCurrency();
      this.setupDomains();
      this.$nameInput.addEventListener('input', () => this.updateAvatar());
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
      this.updateAvatar(name);
   }

   updateAvatar(name = this.$nameInput.value) {
      const trimmed = name?.trim();
      const initial = trimmed ? trimmed.charAt(0).toUpperCase() : 'LC';
      this.$avatar.textContent = initial;
   }

   async ensureProfileService() {
      const existing = slice.getComponent('profile-service');
      if (existing && typeof existing.setDisplayName === 'function') {
         return existing;
      }

      const service = await slice.build('ProfileService', {
         sliceId: 'profile-service',
         singleton: true
      });
      if (!service) {
         return null;
      }

      if (typeof service.init === 'function' && !service.storage) {
         await service.init();
      }

      return typeof service.setDisplayName === 'function' ? service : null;
   }

   showStatus(message, isError = false) {
      this.$saveStatus.textContent = message;
      this.$saveStatus.hidden = false;
      this.$saveStatus.classList.toggle('settings-section__status--error', isError);
   }

   showCacheStatus(message, isError = false) {
      this.$cacheStatus.textContent = message;
      this.$cacheStatus.hidden = false;
      this.$cacheStatus.classList.toggle('settings-section__status--error', isError);
   }

   showBackupStatus(message, isError = false) {
      this.$backupStatus.textContent = message;
      this.$backupStatus.hidden = false;
      this.$backupStatus.classList.toggle('settings-section__status--error', isError);
   }

   setupCurrency() {
      if (!this.$currencySelect) {
         return;
      }
      this.$currencySelect.innerHTML = '';
      for (const currency of CURRENCIES) {
         const option = document.createElement('option');
         option.value = currency.code;
         option.textContent = currency.label;
         this.$currencySelect.appendChild(option);
      }
      this.$currencySelect.value = getPreferredCurrency();
      this.$currencySelect.addEventListener('change', () => {
         setPreferredCurrency(this.$currencySelect.value);
         slice.getComponent('exchange-rate-service')?.fetchRate?.();
      });
   }

   setupDomains() {
      if (!this.$domainList) {
         return;
      }
      this.$addDomain?.addEventListener('click', () => {
         slice.events.emit('ui:modal:open', { title: 'Nuevo dominio', form: 'DomainForm' });
      });
      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderDomains(),
         (state) => ({ domains: state?.domains ?? [], tasks: state?.tasks ?? [] })
      );
      this.renderDomains();
   }

   renderDomains() {
      if (!this.$domainList) {
         return;
      }
      const domainService = slice.getComponent('domain-service');
      const domains = domainService?.getAll?.() ?? [];
      const tasks = slice.getComponent('task-service')?.getAll?.() ?? [];
      this.$domainList.innerHTML = '';
      this.$domainEmpty.hidden = domains.length > 0;

      for (const domain of domains) {
         const pending = tasks.filter((task) => task.domainId === domain.id && !task.completed).length;

         const item = document.createElement('li');
         item.className = 'domains-section__item';

         const meta = document.createElement('div');
         meta.className = 'domains-section__meta';

         const swatch = document.createElement('span');
         swatch.className = 'domains-section__swatch';
         swatch.style.backgroundColor = domain.color;

         const textWrap = document.createElement('div');
         textWrap.className = 'domains-section__text';

         const name = document.createElement('span');
         name.className = 'domains-section__name';
         name.textContent = domain.name;

         const stats = document.createElement('span');
         stats.className = 'domains-section__stats';
         const budgetNote = Number(domain.monthlyBudget) > 0 ? ` · $${Number(domain.monthlyBudget)}/mes` : '';
         stats.textContent = `${pending} pendiente${pending === 1 ? '' : 's'}${budgetNote}`;

         textWrap.append(name, stats);
         meta.append(swatch, textWrap);
         item.appendChild(meta);

         const actions = document.createElement('div');
         actions.className = 'domains-section__actions';

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'domains-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.addEventListener('click', () => {
            slice.events.emit('ui:modal:open', { title: 'Editar dominio', form: 'DomainForm', domainId: domain.id });
         });

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'domains-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', async () => {
            const ok = await domainService?.remove(domain.id);
            if (!ok) {
               window.alert('Debe existir al menos un dominio. Las tareas se reasignan al eliminar uno.');
            }
         });

         actions.append(editBtn, deleteBtn);
         item.appendChild(actions);
         this.$domainList.appendChild(item);
      }
   }

   syncNotificationState() {
      if (!notificationsSupported()) {
         this.$enableNotifications.disabled = true;
         this.$enableNotifications.textContent = 'No disponible en este dispositivo';
         return;
      }

      const permission = notificationPermission();
      if (permission === 'granted') {
         this.$enableNotifications.disabled = true;
         this.$enableNotifications.textContent = 'Notificaciones activadas';
      } else if (permission === 'denied') {
         this.$enableNotifications.disabled = true;
         this.$enableNotifications.textContent = 'Bloqueadas (revisa ajustes del navegador)';
      } else {
         this.$enableNotifications.disabled = false;
         this.$enableNotifications.textContent = 'Activar notificaciones';
      }
   }

   showNotifStatus(message, isError = false) {
      this.$notifStatus.textContent = message;
      this.$notifStatus.hidden = false;
      this.$notifStatus.classList.toggle('settings-section__status--error', isError);
   }

   async enableNotifications() {
      const result = await requestNotificationPermission();
      this.syncNotificationState();

      if (result === 'granted') {
         slice.getComponent('reminder-service')?.check?.();
         this.showNotifStatus('Notificaciones activadas. Te avisaremos de tus recordatorios.');
      } else if (result === 'denied') {
         this.showNotifStatus('Permiso denegado. Actívalo desde los ajustes del navegador.', true);
      } else if (result === 'unsupported') {
         this.showNotifStatus('Tu dispositivo no soporta notificaciones web.', true);
      } else {
         this.showNotifStatus('No se activaron las notificaciones.', true);
      }
   }

   async ensureStorageService() {
      const existing = slice.getComponent('storage-service');
      if (existing?.db) {
         return existing;
      }

      const storage = await slice.build('StorageService', {
         sliceId: 'storage-service',
         singleton: true
      });

      if (!storage) {
         return null;
      }

      if (!storage.db) {
         await storage.init();
      }

      return storage;
   }

   async exportData() {
      if (this._exportingData) {
         return;
      }

      this._exportingData = true;
      this.$exportData.disabled = true;
      this.showBackupStatus('Generando respaldo…');

      try {
         const storage = await this.ensureStorageService();
         if (!storage) {
            throw new Error('StorageService no disponible');
         }

         const backup = await exportAppData(storage);
         const summary = summarizeBackup(backup);
         const total = Object.values(summary).reduce((sum, count) => sum + count, 0);

         if (total === 0) {
            this.showBackupStatus('No hay datos para exportar todavía.', true);
            return;
         }

         const mode = await downloadJsonBackup(backup);
         if (mode === 'shared') {
            this.showBackupStatus(`Respaldo listo (${total} registros). Guárdalo en Archivos o envíalo a tu otro dispositivo.`);
         } else {
            this.showBackupStatus(`Respaldo descargado (${total} registros). Impórtalo en el otro dispositivo.`);
         }
      } catch (error) {
         if (error?.name === 'AbortError') {
            this.showBackupStatus('Exportación cancelada.');
            return;
         }
         console.error('SettingsSection exportData:', error);
         this.showBackupStatus('No se pudo exportar. Intenta de nuevo.', true);
      } finally {
         this.$exportData.disabled = false;
         this._exportingData = false;
      }
   }

   async importData() {
      const file = this.$importFile.files?.[0];
      this.$importFile.value = '';

      if (!file || this._importingData) {
         return;
      }

      this._importingData = true;
      this.showBackupStatus('Leyendo archivo…');

      try {
         const backup = await readBackupFile(file);
         await this.applyBackup(backup);
      } catch (error) {
         console.error('SettingsSection importData:', error);
         this.showBackupStatus(error.message || 'No se pudo importar. Revisa el archivo.', true);
      } finally {
         this._importingData = false;
      }
   }

   async applyBackup(backup) {
      const storage = await this.ensureStorageService();
      if (!storage) {
         throw new Error('StorageService no disponible');
      }

      const summary = summarizeBackup(backup);
      const total = Object.values(summary).reduce((sum, count) => sum + count, 0);

      if (total === 0) {
         throw new Error('El respaldo está vacío.');
      }

      const hasData = await hasStoredData(storage);
      if (hasData) {
         const confirmed = window.confirm(
            'Esto reemplazará todos tus datos actuales en este dispositivo. ¿Continuar?'
         );
         if (!confirmed) {
            this.showBackupStatus('Importación cancelada.');
            return;
         }
      }

      this.showBackupStatus('Importando datos…');
      await importAppData(storage, backup);
      this.showBackupStatus(`Datos sincronizados (${total} registros). Recargando…`);

      setTimeout(() => {
         window.location.reload();
      }, 700);
   }

   async clearCache() {
      if (this._clearingCache) {
         return;
      }

      this._clearingCache = true;
      this.$clearCache.disabled = true;
      this.showCacheStatus('Limpiando caché…');

      try {
         await clearAppCacheAndReload();
      } catch (error) {
         console.error('SettingsSection clearCache:', error);
         this.showCacheStatus('No se pudo limpiar. Recarga manualmente.', true);
         this.$clearCache.disabled = false;
         this._clearingCache = false;
      }
   }

   async saveName() {
      const profileService = await this.ensureProfileService();
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
