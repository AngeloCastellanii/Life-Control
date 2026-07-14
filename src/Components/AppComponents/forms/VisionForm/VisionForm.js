import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;

function readFileAsDataUrl(file) {
   return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
   });
}

export default class VisionForm extends HTMLElement {
   static props = {
      visionId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$title = this.querySelector('#vision-form-title');
      this.$description = this.querySelector('#vision-form-description');
      this.$date = this.querySelector('#vision-form-date');
      this.$imageFile = this.querySelector('#vision-form-image');
      this.$imageUrl = this.querySelector('#vision-form-image-url');
      this.$preview = this.querySelector('[data-role="preview"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._image = '';
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
         submitLabel: this.visionId ? 'Guardar cambios' : 'Guardar'
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
      this.$imageFile.addEventListener('change', () => this.onFileChange());
      this.$imageUrl.addEventListener('input', () => {
         const url = this.$imageUrl.value.trim();
         if (url) {
            this.setImage(url);
         }
      });
      this._formBound = true;
   }

   setImage(src) {
      this._image = src ?? '';
      if (this._image) {
         this.$preview.src = this._image;
         this.$preview.hidden = false;
      } else {
         this.$preview.removeAttribute('src');
         this.$preview.hidden = true;
      }
   }

   async onFileChange() {
      const file = this.$imageFile.files?.[0];
      if (!file) {
         return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
         showFormError(this.$error, 'La imagen supera 2.5 MB. Usa una más liviana o una URL.');
         this.$imageFile.value = '';
         return;
      }
      hideFormError(this.$error);
      try {
         const dataUrl = await readFileAsDataUrl(file);
         this.$imageUrl.value = '';
         this.setImage(dataUrl);
      } catch {
         showFormError(this.$error, 'No se pudo leer la imagen.');
      }
   }

   populate() {
      hideFormError(this.$error);
      if (this.visionId) {
         this.loadItem(this.visionId);
      }
   }

   loadItem(id) {
      const item = getService('vision-service', ['getById'])?.getById(id);
      if (!item) {
         showFormError(this.$error, 'No se encontró la meta.');
         return;
      }
      this.$title.value = item.title;
      this.$description.value = item.description ?? '';
      this.$date.value = item.targetDate ?? '';
      if (item.image?.startsWith('http')) {
         this.$imageUrl.value = item.image;
      }
      this.setImage(item.image ?? '');
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }
      const service = getService('vision-service', ['create', 'update']);
      if (!service) {
         showFormError(this.$error, 'Servicio no disponible. Recarga la página.');
         return;
      }

      const title = this.$title.value.trim();
      if (!title) {
         showFormError(this.$error, 'Ingresa el nombre de la meta.');
         return;
      }

      const payload = {
         title,
         description: this.$description.value.trim(),
         image: this._image,
         targetDate: this.$date.value || null
      };

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = this.visionId
            ? await service.update(this.visionId, payload)
            : await service.create(payload);
         if (saved) {
            closeModal();
            return;
         }
         showFormError(this.$error, 'No se pudo guardar la meta.');
      } catch (error) {
         console.error('VisionForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-vision-form', VisionForm);
