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

   renderList() {
      const items = this.service.getAll();
      this.$grid.innerHTML = '';
      this.$empty.hidden = items.length > 0;

      for (const item of items) {
         const card = document.createElement('article');
         card.className = 'vision-section__card lc-card';
         if (item.achieved) {
            card.classList.add('vision-section__card--achieved');
         }

         if (item.image) {
            const media = document.createElement('div');
            media.className = 'vision-section__media';
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.title;
            img.loading = 'lazy';
            media.appendChild(img);
            card.appendChild(media);
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
            badge.textContent = `🎯 ${formatTarget(item.targetDate)}`;
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
         deleteBtn.addEventListener('click', () => this.service.remove(item.id));

         actions.append(achieveBtn, editBtn, deleteBtn);
         body.appendChild(actions);
         card.appendChild(body);

         this.$grid.appendChild(card);
      }
   }
}

customElements.define('slice-vision-section', VisionSection);
