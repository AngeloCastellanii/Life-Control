const STORE = 'vision';
const MAX_IMAGES = 4;

function nowISO() {
   return new Date().toISOString();
}

function normalizeImages(item) {
   if (Array.isArray(item.images)) {
      return item.images.filter((src) => typeof src === 'string' && src.trim()).slice(0, MAX_IMAGES);
   }
   if (typeof item.image === 'string' && item.image.trim()) {
      return [item.image.trim()];
   }
   return [];
}

function normalize(item) {
   const images = normalizeImages(item);
   return {
      id: item.id,
      title: (item.title ?? '').trim(),
      description: item.description ?? '',
      images,
      /** @deprecated compat: primera imagen */
      image: images[0] ?? '',
      targetDate: item.targetDate ?? null,
      achieved: Boolean(item.achieved),
      order: Number.isFinite(item.order) ? item.order : 0,
      createdAt: item.createdAt ?? nowISO(),
      updatedAt: item.updatedAt ?? item.createdAt ?? nowISO()
   };
}

function compare(a, b) {
   if (a.achieved !== b.achieved) {
      return a.achieved ? 1 : -1;
   }
   if (a.order !== b.order) {
      return a.order - b.order;
   }
   return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

export { MAX_IMAGES };

export default class VisionService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage) {
         throw new Error('StorageService no está disponible');
      }
      if (!this.storage.db) {
         await this.storage.init();
      }
      await this.syncToContext();
   }

   async syncToContext() {
      const vision = (await this.storage.getAll(STORE)).map(normalize);
      vision.sort(compare);
      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         vision
      }));
   }

   getAll() {
      return (slice.context.getState('lifeControl')?.vision ?? []).map(normalize);
   }

   getById(id) {
      return this.getAll().find((item) => item.id === id) ?? null;
   }

   async create({ title, description, images, image, targetDate }) {
      const trimmed = title?.trim();
      if (!trimmed) {
         return null;
      }
      const list = normalizeImages({ images, image });
      const item = normalize({
         id: crypto.randomUUID(),
         title: trimmed,
         description: description ?? '',
         images: list,
         targetDate: targetDate || null,
         achieved: false,
         order: this.getAll().length,
         createdAt: nowISO(),
         updatedAt: nowISO()
      });
      await this.storage.put(STORE, item);
      await this.syncToContext();
      slice.events.emit('vision:changed', { action: 'create', item });
      return item;
   }

   async update(id, patch) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      const next = { ...existing, ...patch, id, updatedAt: nowISO() };
      if (patch.images !== undefined || patch.image !== undefined) {
         next.images = normalizeImages(patch.images !== undefined ? patch : { ...existing, ...patch });
      }
      const updated = normalize(next);
      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('vision:changed', { action: 'update', item: updated });
      return updated;
   }

   async toggleAchieved(id) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      return this.update(id, { achieved: !existing.achieved });
   }

   async remove(id) {
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('vision:changed', { action: 'delete', id });
      return true;
   }
}
