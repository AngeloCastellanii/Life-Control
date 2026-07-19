function formatTarget(iso) {
   if (!iso) {
      return '';
   }
   const date = new Date(`${iso}T12:00:00`);
   if (Number.isNaN(date.getTime())) {
      return '';
   }
   return date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO() {
   return new Date().toISOString().slice(0, 10);
}

function getImages(item) {
   if (Array.isArray(item.images) && item.images.length) {
      return item.images;
   }
   return item.image ? [item.image] : [];
}

export default class VisionSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'vision-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$grid = this.querySelector('[data-role="grid"]');
      this.$empty = this.querySelector('[data-role="empty"]');
      this._lightbox = null;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.service = slice.getComponent('vision-service');
      if (!this.service) {
         slice.logger?.logError?.('VisionSection', 'VisionService no disponible');
         return;
      }

      slice.context.watch(
         'lifeControl',
         this,
         () => this.renderList(),
         (state) => ({ vision: state?.vision ?? [] })
      );

      this.renderList();
   }

   openEdit(id) {
      slice.events.emit('ui:modal:open', {
         title: 'Editar meta',
         form: 'VisionForm',
         visionId: id
      });
   }

   openLightbox(images, startIndex = 0) {
      this.closeLightbox();
      if (!images.length) {
         return;
      }

      let index = Math.max(0, Math.min(startIndex, images.length - 1));

      const root = document.createElement('div');
      root.className = 'vision-lightbox';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Vista de imagen');

      const backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'vision-lightbox__backdrop';
      backdrop.setAttribute('aria-label', 'Cerrar');
      backdrop.addEventListener('click', () => this.closeLightbox());

      const figure = document.createElement('div');
      figure.className = 'vision-lightbox__frame';

      const img = document.createElement('img');
      img.className = 'vision-lightbox__img';
      img.alt = 'Foto ampliada';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'vision-lightbox__close';
      closeBtn.setAttribute('aria-label', 'Cerrar');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.closeLightbox());

      const counter = document.createElement('span');
      counter.className = 'vision-lightbox__counter';

      const show = () => {
         img.src = images[index];
         counter.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : '';
         counter.hidden = images.length <= 1;
         if (prevBtn) {
            prevBtn.hidden = images.length <= 1;
         }
         if (nextBtn) {
            nextBtn.hidden = images.length <= 1;
         }
      };

      let prevBtn = null;
      let nextBtn = null;

      if (images.length > 1) {
         prevBtn = document.createElement('button');
         prevBtn.type = 'button';
         prevBtn.className = 'vision-lightbox__nav vision-lightbox__nav--prev';
         prevBtn.setAttribute('aria-label', 'Anterior');
         prevBtn.textContent = '‹';
         prevBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            index = (index - 1 + images.length) % images.length;
            show();
         });

         nextBtn = document.createElement('button');
         nextBtn.type = 'button';
         nextBtn.className = 'vision-lightbox__nav vision-lightbox__nav--next';
         nextBtn.setAttribute('aria-label', 'Siguiente');
         nextBtn.textContent = '›';
         nextBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            index = (index + 1) % images.length;
            show();
         });
      }

      const onKey = (event) => {
         if (event.key === 'Escape') {
            this.closeLightbox();
         } else if (event.key === 'ArrowLeft' && images.length > 1) {
            index = (index - 1 + images.length) % images.length;
            show();
         } else if (event.key === 'ArrowRight' && images.length > 1) {
            index = (index + 1) % images.length;
            show();
         }
      };

      figure.append(img, closeBtn, counter);
      if (prevBtn) {
         figure.append(prevBtn, nextBtn);
      }
      root.append(backdrop, figure);
      document.body.appendChild(root);
      document.addEventListener('keydown', onKey);
      show();

      this._lightbox = { root, onKey };
   }

   closeLightbox() {
      if (!this._lightbox) {
         return;
      }
      document.removeEventListener('keydown', this._lightbox.onKey);
      this._lightbox.root.remove();
      this._lightbox = null;
   }

   buildMediaCollage(images, title) {
      const media = document.createElement('div');
      const count = Math.min(images.length, 4);
      media.className = `vision-section__media vision-section__media--${count}`;

      images.slice(0, 4).forEach((src, index) => {
         const cell = document.createElement('button');
         cell.type = 'button';
         cell.className = 'vision-section__cell';
         cell.setAttribute('aria-label', `Ver foto ${index + 1} de ${title}`);

         const img = document.createElement('img');
         img.src = src;
         img.alt = title;
         img.loading = 'lazy';
         img.addEventListener('error', () => {
            cell.hidden = true;
         });

         cell.appendChild(img);
         cell.addEventListener('click', () => this.openLightbox(images, index));
         media.appendChild(cell);
      });

      return media;
   }

   renderList() {
      const items = this.service.getAll();
      this.$grid.innerHTML = '';
      this.$empty.hidden = items.length > 0;
      const today = todayISO();

      for (const item of items) {
         const card = document.createElement('article');
         card.className = 'vision-section__card lc-card';
         if (item.achieved) {
            card.classList.add('vision-section__card--achieved');
         }

         const images = getImages(item);
         if (images.length > 0) {
            card.appendChild(this.buildMediaCollage(images, item.title));
         }

         const body = document.createElement('div');
         body.className = 'vision-section__body';

         const title = document.createElement('h3');
         title.className = 'vision-section__title';
         title.textContent = item.title;
         body.appendChild(title);

         if (item.description) {
            const desc = document.createElement('p');
            desc.className = 'vision-section__desc';
            desc.textContent = item.description;
            body.appendChild(desc);
         }

         if (item.targetDate) {
            const badge = document.createElement('span');
            badge.className = 'vision-section__target';
            const overdue = !item.achieved && item.targetDate < today;
            badge.classList.toggle('vision-section__target--overdue', overdue);
            badge.textContent = `${overdue ? '⚠️' : '🎯'} ${formatTarget(item.targetDate)}`;
            body.appendChild(badge);
         }

         const actions = document.createElement('div');
         actions.className = 'vision-section__actions';

         const achieveBtn = document.createElement('button');
         achieveBtn.type = 'button';
         achieveBtn.className = 'vision-section__achieve';
         achieveBtn.textContent = item.achieved ? '✓ Lograda' : 'Marcar lograda';
         achieveBtn.addEventListener('click', () => this.service.toggleAchieved(item.id));

         const editBtn = document.createElement('button');
         editBtn.type = 'button';
         editBtn.className = 'vision-section__edit';
         editBtn.textContent = 'Editar';
         editBtn.addEventListener('click', () => this.openEdit(item.id));

         const deleteBtn = document.createElement('button');
         deleteBtn.type = 'button';
         deleteBtn.className = 'vision-section__delete';
         deleteBtn.textContent = 'Eliminar';
         deleteBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar esta meta del Vision Board?')) {
               this.service.remove(item.id);
            }
         });

         actions.append(achieveBtn, editBtn, deleteBtn);
         body.appendChild(actions);
         card.appendChild(body);

         this.$grid.appendChild(card);
      }
   }

   disconnectedCallback() {
      this.closeLightbox();
   }
}

customElements.define('slice-vision-section', VisionSection);
