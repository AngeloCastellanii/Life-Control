const DEFAULT_STORES = ['domains', 'tasks', 'timeBlocks', 'finances', 'shopping', 'notes', 'habits', 'vision', 'paymentMethods', 'meta'];

function isClosingError(error) {
   const message = String(error?.message || error || '');
   return (
      error?.name === 'InvalidStateError' ||
      /connection is closing/i.test(message) ||
      /database connection is closing/i.test(message)
   );
}

export default class StorageService {
   constructor(props = {}) {
      this.dbName = props.dbName ?? 'life-control';
      this.dbVersion = props.dbVersion ?? 6;
      this.stores = props.stores ?? DEFAULT_STORES;
      this.db = null;
      this._opening = null;
   }

   async init() {
      await this.ensureDb();
      return this;
   }

   invalidateDb() {
      try {
         this.db?.close();
      } catch {
         /* ignore */
      }
      this.db = null;
   }

   async ensureDb() {
      if (this.db) {
         try {
            // Si la conexión ya se está cerrando, objectStoreNames puede fallar.
            void this.db.objectStoreNames.length;
            return this.db;
         } catch {
            this.db = null;
         }
      }

      if (this._opening) {
         return this._opening;
      }

      this._opening = this.openDb()
         .then((db) => {
            this.db = db;
            db.onversionchange = () => {
               try {
                  db.close();
               } catch {
                  /* ignore */
               }
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

   async withDbRetry(operation) {
      try {
         return await operation(await this.ensureDb());
      } catch (error) {
         if (!isClosingError(error)) {
            throw error;
         }
         this.invalidateDb();
         return operation(await this.ensureDb());
      }
   }

   async getAll(storeName) {
      return this.withDbRetry((db) => {
         if (!db.objectStoreNames.contains(storeName)) {
            return Promise.resolve([]);
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
      });
   }

   async put(storeName, item) {
      return this.withDbRetry(
         (db) =>
            new Promise((resolve, reject) => {
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
            })
      );
   }

   async putAll(storeName, items) {
      return this.withDbRetry((db) => {
         if (!db.objectStoreNames.contains(storeName)) {
            return Promise.resolve(true);
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
      });
   }

   async delete(storeName, id) {
      return this.withDbRetry(
         (db) =>
            new Promise((resolve, reject) => {
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
            })
      );
   }

   async clearStore(storeName) {
      return this.withDbRetry((db) => {
         if (!db.objectStoreNames.contains(storeName)) {
            return Promise.resolve(true);
         }
         return new Promise((resolve, reject) => {
            try {
               const tx = db.transaction(storeName, 'readwrite');
               tx.objectStore(storeName).clear();
               tx.oncomplete = () => resolve(true);
               tx.onerror = () => reject(tx.error);
            } catch (error) {
               this.db = null;
               reject(error);
            }
         });
      });
   }

   /** Limpia y escribe un store en una sola transacción. */
   async replaceStore(storeName, items) {
      return this.withDbRetry((db) => {
         if (!db.objectStoreNames.contains(storeName)) {
            return Promise.resolve(true);
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
      });
   }

   /** Reemplaza varios stores en una sola transacción (más estable en PWA/móvil). */
   async replaceAllStores(storesMap) {
      return this.withDbRetry((db) => {
         const names = Object.keys(storesMap).filter((name) => db.objectStoreNames.contains(name));
         if (names.length === 0) {
            return Promise.resolve(true);
         }

         return new Promise((resolve, reject) => {
            try {
               const tx = db.transaction(names, 'readwrite');
               for (const name of names) {
                  const store = tx.objectStore(name);
                  store.clear();
                  for (const item of storesMap[name] ?? []) {
                     store.put(item);
                  }
               }
               tx.oncomplete = () => resolve(true);
               tx.onerror = () => reject(tx.error);
               tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
            } catch (error) {
               this.db = null;
               reject(error);
            }
         });
      });
   }
}
