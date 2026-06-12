const META_STORE = 'meta';
const PROFILE_ID = 'profile';

export default class ProfileService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage) {
         return;
      }
      if (!this.storage.db) {
         await this.storage.init();
      }
      await this.syncToContext();
   }

   async syncToContext() {
      if (!this.storage) {
         return;
      }
      const items = await this.storage.getAll(META_STORE);
      const stored = items.find((item) => item.id === PROFILE_ID);
      const displayName = stored?.displayName?.trim() ?? '';

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         profile: { displayName }
      }));
   }

   getDisplayName() {
      return slice.context.getState('lifeControl')?.profile?.displayName ?? '';
   }

   async setDisplayName(displayName) {
      const trimmed = displayName?.trim() ?? '';
      await this.storage.put(META_STORE, { id: PROFILE_ID, displayName: trimmed });
      await this.syncToContext();
      slice.events.emit('profile:changed', { displayName: trimmed });
      return trimmed;
   }
}
