const DEFAULT_STORES = ['domains', 'tasks', 'timeBlocks', 'finances', 'shopping', 'notes', 'vision', 'paymentMethods', 'meta'];

export default class StorageService {
   constructor(props = {}) {
      this.dbName = props.dbName ?? 'life-control';
      this.dbVersion = props.dbVersion ?? 5;
      this.stores = props.stores ?? DEFAULT_STORES;
      this.db = null;
      this._opening = null;
   }

   async init() {
      await this.ensureDb();
      return this;
   }

   async ensureDb() {
      if (this.db) {
         return this.db;
      }

      if (this._opening) {
         return this._opening;
      }

      this._opening = this.openDb()
         .then((db) => {
            this.db = db;
            db.onversionchange = () => {
               db.close();
               if (this.db === db) {
                  this.db = null;
               }
            };
            db.onclose = () => {
               if (this.db === db) {
                  this.db = null;
               }
            };
            return db;
         })
         .finally(() => {
            this._opening = null;
         });

      return this._opening;
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
         request.onblocked = () => {
            reject(new Error('IndexedDB bloqueada. Cierra otras pestañas de Life Control e inténtalo de nuevo.'));
         };
      });
   }

   async getAll(storeName) {
      const db = await this.ensureDb();
      if (!db.objectStoreNames.contains(storeName)) {
         return [];
      }
      return new Promise((resolve, reject) => {
         try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result ?? []);
            req.onerror = () => reject(req.error);
         } catch (error) {
            this.db = null;
            reject(error);
         }
      });
   }

   async put(storeName, item) {
      const db = await this.ensureDb();
      return new Promise((resolve, reject) => {
         try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => resolve(item);
            req.onerror = () => reject(req.error);
            tx.onerror = () => reject(tx.error);
         } catch (error) {
            this.db = null;
            reject(error);
         }
      });
   }

   async putAll(storeName, items) {
      const db = await this.ensureDb();
      if (!db.objectStoreNames.contains(storeName)) {
         return;
      }

      return new Promise((resolve, reject) => {
         try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            for (const item of items) {
               store.put(item);
            }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
         } catch (error) {
            this.db = null;
            reject(error);
         }
      });
   }

   async delete(storeName, id) {
      const db = await this.ensureDb();
      return new Promise((resolve, reject) => {
         try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
         } catch (error) {
            this.db = null;
            reject(error);
         }
      });
   }

   async clearStore(storeName) {
      const db = await this.ensureDb();
      if (!db.objectStoreNames.contains(storeName)) {
         return true;
      }
      return new Promise((resolve, reject) => {
         try {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
         } catch (error) {
            this.db = null;
            reject(error);
         }
      });
   }

   /** Limpia y escribe un store en una sola transacción (más estable al importar). */
   async replaceStore(storeName, items) {
      const db = await this.ensureDb();
      if (!db.objectStoreNames.contains(storeName)) {
         return;
      }

      return new Promise((resolve, reject) => {
         try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear();
            for (const item of items) {
               store.put(item);
            }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
         } catch (error) {
            this.db = null;
            reject(error);
         }
      });
   }
}
