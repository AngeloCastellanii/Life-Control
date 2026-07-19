import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_IMAGES = 4;

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
      this.$addUrl = this.querySelector('[data-role="add-url"]');
      this.$thumbs = this.querySelector('[data-role="thumbs"]');
      this.$clearImage = this.querySelector('[data-role="clear-image"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._images = [];
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
      this.$addUrl.addEventListener('click', () => this.addUrl());
      this.$imageUrl.addEventListener('keydown', (event) => {
         if (event.key === 'Enter') {
            event.preventDefault();
            this.addUrl();
         }
      });
      this.$clearImage.addEventListener('click', () => {
         this.$imageFile.value = '';
         this.$imageUrl.value = '';
         this._images = [];
         this.renderThumbs();
         hideFormError(this.$error);
      });
      this._formBound = true;
   }

   addUrl() {
      const url = this.$imageUrl.value.trim();
      if (!url) {
         return;
      }
      if (this._images.length >= MAX_IMAGES) {
         showFormError(this.$error, `Máximo ${MAX_IMAGES} fotos por meta.`);
         return;
      }
      this._images.push(url);
      this.$imageUrl.value = '';
      this.renderThumbs();
      hideFormError(this.$error);
   }

   removeAt(index) {
      this._images.splice(index, 1);
      this.renderThumbs();
   }

   renderThumbs() {
      this.$thumbs.innerHTML = '';
      this.$clearImage.hidden = this._images.length === 0;

      this._images.forEach((src, index) => {
         const li = document.createElement('li');
         li.className = 'vision-form__thumb';

         const img = document.createElement('img');
         img.src = src;
         img.alt = `Foto ${index + 1}`;
         img.addEventListener('error', () => {
            li.classList.add('vision-form__thumb--broken');
         });

         const remove = document.createElement('button');
         remove.type = 'button';
         remove.className = 'vision-form__thumb-remove';
         remove.setAttribute('aria-label', 'Quitar foto');
         remove.textContent = '×';
         remove.addEventListener('click', () => this.removeAt(index));

         li.append(img, remove);
         this.$thumbs.appendChild(li);
      });
   }

   async onFileChange() {
      const files = [...(this.$imageFile.files ?? [])];
      this.$imageFile.value = '';
      if (files.length === 0) {
         return;
      }

      const room = MAX_IMAGES - this._images.length;
      if (room <= 0) {
         showFormError(this.$error, `Máximo ${MAX_IMAGES} fotos por meta.`);
         return;
      }

      hideFormError(this.$error);
      for (const file of files.slice(0, room)) {
         if (file.size > MAX_IMAGE_BYTES) {
            showFormError(this.$error, `"${file.name}" supera 2.5 MB.`);
            continue;
         }
         try {
            const dataUrl = await readFileAsDataUrl(file);
            this._images.push(dataUrl);
         } catch {
            showFormError(this.$error, `No se pudo leer "${file.name}".`);
         }
      }
      this.renderThumbs();
   }

   populate() {
      hideFormError(this.$error);
      this.$imageFile.value = '';
      this.$imageUrl.value = '';
      this._images = [];
      this.renderThumbs();
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
      this._images = [...(item.images?.length ? item.images : item.image ? [item.image] : [])];
      this.renderThumbs();
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
         images: this._images,
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
