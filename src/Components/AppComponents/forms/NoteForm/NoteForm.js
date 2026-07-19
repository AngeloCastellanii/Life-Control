import {
   buildModalButtons,
   closeModal,
   getService,
   hideFormError,
   showFormError
} from '../formHelpers.js';
import { getNoteColors } from '../../sections/noteColors.js';
import { looksLikeListText, parseListText } from '../../sections/parseListText.js';

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

function toChecklistItems(parsed) {
   return parsed.map((item) => ({
      id: crypto.randomUUID(),
      text: item.text,
      done: Boolean(item.done)
   }));
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
      this.$bodyField = this.querySelector('[data-role="body-field"]');
      this.$listField = this.querySelector('[data-role="list-field"]');
      this.$checklist = this.querySelector('[data-role="checklist"]');
      this.$listInput = this.querySelector('#note-form-list-input');
      this.$addItem = this.querySelector('[data-role="add-item"]');
      this.$types = this.querySelector('[data-role="types"]');
      this.$remind = this.querySelector('#note-form-remind');
      this.$pinned = this.querySelector('#note-form-pinned');
      this.$colors = this.querySelector('[data-role="colors"]');
      this.$error = this.querySelector('[data-role="error"]');
      this._type = 'text';
      this._checklist = [];
      this._color = getNoteColors()[0];
      this._buttonsReady = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.renderColors();
      this.bindTypeButtons();
      this.bindListControls();
      this.bindSmartPaste();
      await this.ensureButtons();
      this.bindForm();
      this.populate();
   }

   async update() {
      this.renderColors(true);
      await this.ensureButtons();
      this.populate();
   }

   bindTypeButtons() {
      if (this._typesBound) {
         return;
      }
      this.$types.addEventListener('click', (event) => {
         const button = event.target.closest('[data-type]');
         if (!button) {
            return;
         }
         this.setType(button.dataset.type);
      });
      this._typesBound = true;
   }

   bindListControls() {
      if (this._listBound) {
         return;
      }
      this.$addItem.addEventListener('click', () => this.addChecklistItem());
      this.$listInput.addEventListener('keydown', (event) => {
         if (event.key === 'Enter') {
            event.preventDefault();
            this.addChecklistItem();
         }
      });
      this._listBound = true;
   }

   bindSmartPaste() {
      if (this._pasteBound) {
         return;
      }

      this.$body.addEventListener('paste', (event) => {
         const text = event.clipboardData?.getData('text/plain') ?? '';
         if (!looksLikeListText(text)) {
            return;
         }
         event.preventDefault();
         this.applyParsedList(parseListText(text), { switchToList: true, clearBody: true });
      });

      this.$listInput.addEventListener('paste', (event) => {
         const text = event.clipboardData?.getData('text/plain') ?? '';
         if (!text.trim()) {
            return;
         }
         const parsed = parseListText(text);
         if (parsed.length <= 1 && !text.includes('\n')) {
            return;
         }
         event.preventDefault();
         this.applyParsedList(parsed, { switchToList: true });
         this.$listInput.value = '';
      });

      this._pasteBound = true;
   }

   applyParsedList(parsed, { switchToList = false, clearBody = false, replace = false } = {}) {
      const items = toChecklistItems(parsed);
      if (items.length === 0) {
         return;
      }

      if (replace || this._checklist.length === 0) {
         this._checklist = items;
      } else {
         this._checklist = [...this._checklist, ...items];
      }

      if (switchToList) {
         this.setType('list', { convertBody: false });
      }
      if (clearBody) {
         this.$body.value = '';
      }
      this.renderChecklist();
      hideFormError(this.$error);
   }

   setType(type, { convertBody = true } = {}) {
      const next = type === 'list' ? 'list' : 'text';
      const prev = this._type;
      this._type = next;

      for (const button of this.$types.querySelectorAll('[data-type]')) {
         button.classList.toggle('note-form__type--active', button.dataset.type === this._type);
      }
      this.$bodyField.hidden = this._type !== 'text';
      this.$listField.hidden = this._type !== 'list';

      if (convertBody && prev === 'text' && next === 'list') {
         const body = this.$body.value.trim();
         if (body && this._checklist.length === 0) {
            this.applyParsedList(parseListText(body), { clearBody: true, replace: true });
         } else if (body && looksLikeListText(body)) {
            this.applyParsedList(parseListText(body), { clearBody: true, replace: false });
         }
      }
   }

   addChecklistItem() {
      const raw = this.$listInput.value.trim();
      if (!raw) {
         return;
      }

      if (raw.includes('\n') || looksLikeListText(raw)) {
         this.applyParsedList(parseListText(raw));
         this.$listInput.value = '';
         this.$listInput.focus();
         return;
      }

      this._checklist.push({ id: crypto.randomUUID(), text: raw, done: false });
      this.$listInput.value = '';
      this.renderChecklist();
      this.$listInput.focus();
   }

   removeChecklistItem(id) {
      this._checklist = this._checklist.filter((item) => item.id !== id);
      this.renderChecklist();
   }

   renderChecklist() {
      this.$checklist.innerHTML = '';
      this._checklist.forEach((item, index) => {
         const li = document.createElement('li');
         li.className = 'note-form__check-item';

         const num = document.createElement('span');
         num.className = 'note-form__check-num';
         num.textContent = `${index + 1}.`;

         const text = document.createElement('span');
         text.className = 'note-form__check-text';
         text.textContent = item.text;

         const remove = document.createElement('button');
         remove.type = 'button';
         remove.className = 'note-form__check-remove';
         remove.setAttribute('aria-label', 'Quitar ítem');
         remove.textContent = '×';
         remove.addEventListener('click', () => this.removeChecklistItem(item.id));

         li.append(num, text, remove);
         this.$checklist.appendChild(li);
      });
   }

   renderColors(force = false) {
      if (!force && this.$colors.childElementCount > 0) {
         return;
      }
      this.$colors.innerHTML = '';
      const colors = getNoteColors();
      if (!colors.includes(this._color)) {
         this._color = colors[0];
      }
      for (const color of colors) {
         const swatch = document.createElement('button');
         swatch.type = 'button';
         swatch.className = 'note-form__color';
         swatch.style.backgroundColor = color;
         swatch.dataset.color = color;
         swatch.setAttribute('aria-label', `Color ${color}`);
         swatch.addEventListener('click', () => this.selectColor(color));
         this.$colors.appendChild(swatch);
      }
      this.selectColor(this._color);
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
      this._checklist = [];
      if (this.noteId) {
         this.loadNote(this.noteId);
      } else {
         this.setType('text', { convertBody: false });
         this.selectColor(getNoteColors()[0]);
         this.renderChecklist();
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
      this._checklist = (note.checklist ?? []).map((item) => ({ ...item }));
      this.setType(note.type === 'list' ? 'list' : 'text', { convertBody: false });
      this.renderChecklist();
      this.selectColor(note.color || getNoteColors()[0]);
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

      if (this._type === 'list') {
         if (!title && this._checklist.length === 0) {
            showFormError(this.$error, 'Añade un título o al menos un ítem.');
            return;
         }
      } else if (!title && !body) {
         showFormError(this.$error, 'Escribe un título o contenido.');
         return;
      }

      const payload = {
         title,
         body: this._type === 'text' ? body : '',
         type: this._type,
         checklist: this._type === 'list' ? this._checklist : [],
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
