const DEFAULT_STORES = ['domains', 'tasks', 'timeBlocks', 'finances', 'shopping', 'notes', 'vision', 'meta'];

export default class StorageService {
   constructor(props = {}) {
      this.dbName = props.dbName ?? 'life-control';
      this.dbVersion = props.dbVersion ?? 4;
      this.stores = props.stores ?? DEFAULT_STORES;
      this.db = null;
   }

   async init() {
      this.db = await this.openDb();
      return this;
   }

   openDb() {
      return new Promise((resolve, reject) => {
         const request = indexedDB.open(this.dbName, this.dbVersion);

         request.onupgradeneeded = (event) => {
            const db = event.target.result;
            for (const storeName of this.stores) {
               if (!db.objectStoreNames.contains(storeName)) {
                  db.createObjectStore(storeName, { keyPath: 'id' });
               }
            }
         };

         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
      });
   }

   async getAll(storeName) {
      if (!this.db || !this.db.objectStoreNames.contains(storeName)) {
         return [];
      }
      return new Promise((resolve, reject) => {
         try {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result ?? []);
            req.onerror = () => reject(req.error);
         } catch (error) {
            resolve([]);
         }
      });
   }

   async put(storeName, item) {
      return new Promise((resolve, reject) => {
         const tx = this.db.transaction(storeName, 'readwrite');
         const store = tx.objectStore(storeName);
         const req = store.put(item);
         req.onsuccess = () => resolve(item);
         req.onerror = () => reject(req.error);
      });
   }

   async delete(storeName, id) {
      return new Promise((resolve, reject) => {
         const tx = this.db.transaction(storeName, 'readwrite');
         const store = tx.objectStore(storeName);
         const req = store.delete(id);
         req.onsuccess = () => resolve(true);
         req.onerror = () => reject(req.error);
      });
   }

   async clearStore(storeName) {
      return new Promise((resolve, reject) => {
         const tx = this.db.transaction(storeName, 'readwrite');
         const req = tx.objectStore(storeName).clear();
         req.onsuccess = () => resolve(true);
         req.onerror = () => reject(req.error);
      });
   }
}
