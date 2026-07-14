import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';
import { NOTE_COLORS } from '../../sections/noteColors.js';

function isoToLocalInput(iso) {
   if (!iso) {
      return '';
   }
   const date = new Date(iso);
   if (Number.isNaN(date.getTime())) {
      return '';
   }
   const pad = (n) => String(n).padStart(2, '0');
   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value) {
   if (!value) {
      return null;
   }
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default class NoteForm extends HTMLElement {
   static props = {
      noteId: { type: 'string', default: null }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$form = this.querySelector('[data-role="form"]');
      this.$actions = this.querySelector('[data-role="actions"]');
      this.$title = this.querySelector('#note-form-title');
      this.$body = this.querySelector('#note-form-body');
      this.$remind = this.querySelector('#note-form-remind');
      this.$pinned = this.querySelector('#note-form-pinned');
      this.$colors = this.querySelector('[data-role="colors"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._color = NOTE_COLORS[0];
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.renderColors();
      await this.ensureButtons();
      this.bindForm();
      this.populate();
   }

   async update() {
      await this.ensureButtons();
      this.populate();
   }

   renderColors() {
      if (this.$colors.childElementCount > 0) {
         return;
      }
      for (const color of NOTE_COLORS) {
         const swatch = document.createElement('button');
         swatch.type = 'button';
         swatch.className = 'note-form__color';
         swatch.style.backgroundColor = color;
         swatch.dataset.color = color;
         swatch.setAttribute('aria-label', `Color ${color}`);
         swatch.addEventListener('click', () => this.selectColor(color));
         this.$colors.appendChild(swatch);
      }
   }

   selectColor(color) {
      this._color = color;
      for (const swatch of this.$colors.children) {
         swatch.classList.toggle('note-form__color--active', swatch.dataset.color === color);
      }
   }

   async ensureButtons() {
      if (this._buttonsReady && this.$actions.childElementCount >= 2) {
         return;
      }
      await buildModalButtons(this, {
         submitLabel: this.noteId ? 'Guardar cambios' : 'Guardar'
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
      this._formBound = true;
   }

   populate() {
      hideFormError(this.$error);
      if (this.noteId) {
         this.loadNote(this.noteId);
      } else {
         this.selectColor(NOTE_COLORS[0]);
      }
   }

   loadNote(noteId) {
      const notesService = getService('notes-service', ['getById']);
      const note = notesService?.getById(noteId);
      if (!note) {
         showFormError(this.$error, 'No se encontró la nota.');
         return;
      }

      this.$title.value = note.title;
      this.$body.value = note.body;
      this.$remind.value = isoToLocalInput(note.remindAt);
      this.$pinned.checked = note.pinned;
      this.selectColor(note.color || NOTE_COLORS[0]);
   }

   async handleSubmit() {
      if (this._submitting) {
         return;
      }

      const notesService = getService('notes-service', ['create', 'update']);
      if (!notesService) {
         showFormError(this.$error, 'Servicio de notas no disponible. Recarga la página.');
         return;
      }

      const title = this.$title.value.trim();
      const body = this.$body.value.trim();
      if (!title && !body) {
         showFormError(this.$error, 'Escribe un título o contenido.');
         return;
      }

      const payload = {
         title,
         body,
         color: this._color,
         remindAt: localInputToIso(this.$remind.value),
         pinned: this.$pinned.checked
      };

      this._submitting = true;
      hideFormError(this.$error);
      try {
         const saved = this.noteId
            ? await notesService.update(this.noteId, payload)
            : await notesService.create(payload);

         if (saved) {
            closeModal();
            return;
         }

         showFormError(this.$error, 'No se pudo guardar la nota.');
      } catch (error) {
         console.error('NoteForm submit error:', error);
         showFormError(this.$error, 'Error al guardar. Intenta de nuevo.');
      } finally {
         this._submitting = false;
      }
   }
}

customElements.define('slice-note-form', NoteForm);
