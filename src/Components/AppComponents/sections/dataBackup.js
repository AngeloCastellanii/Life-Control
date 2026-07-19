const BACKUP_VERSION = 1;
const STORE_NAMES = ['domains', 'tasks', 'timeBlocks', 'finances', 'shopping', 'notes', 'vision', 'paymentMethods', 'meta'];

function isBackupPayload(value) {
   if (!value || typeof value !== 'object' || !value.stores || typeof value.stores !== 'object') {
      return false;
   }

   return STORE_NAMES.every((storeName) => {
      const items = value.stores[storeName];
      return items === undefined || Array.isArray(items);
   });
}

export async function exportAppData(storage) {
   if (!storage?.db) {
      await storage.init();
   }

   const stores = {};
   for (const storeName of STORE_NAMES) {
      stores[storeName] = await storage.getAll(storeName);
   }

   return {
      version: BACKUP_VERSION,
      app: 'life-control',
      exportedAt: new Date().toISOString(),
      stores
   };
}

export async function downloadJsonBackup(data) {
   const date = new Date().toISOString().slice(0, 10);
   const filename = `life-control-backup-${date}.json`;
   const json = JSON.stringify(data, null, 2);
   const blob = new Blob([json], { type: 'application/json' });
   const file = new File([blob], filename, { type: 'application/json' });

   // iOS / PWA: el atributo download no funciona; Compartir → Archivos sí
   if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
         files: [file],
         title: 'Life Control — Respaldo',
         text: 'Respaldo de tus datos de Life Control'
      });
      return 'shared';
   }

   const url = URL.createObjectURL(blob);
   const anchor = document.createElement('a');
   anchor.href = url;
   anchor.download = filename;
   anchor.style.display = 'none';
   document.body.appendChild(anchor);
   anchor.click();
   anchor.remove();
   setTimeout(() => URL.revokeObjectURL(url), 2000);
   return 'download';
}

export async function readBackupFile(file) {
   const text = await file.text();
   let parsed;

   try {
      parsed = JSON.parse(text);
   } catch {
      throw new Error('El archivo no es un JSON válido.');
   }

   if (!isBackupPayload(parsed)) {
      throw new Error('El archivo no parece un respaldo de Life Control.');
   }

   return parsed;
}

export function summarizeBackup(data) {
   const summary = {};
   for (const storeName of STORE_NAMES) {
      summary[storeName] = (data.stores?.[storeName] ?? []).length;
   }
   return summary;
}

export async function hasStoredData(storage) {
   if (!storage?.db) {
      await storage.init();
   }

   for (const storeName of STORE_NAMES) {
      const items = await storage.getAll(storeName);
      if (items.length > 0) {
         return true;
      }
   }

   return false;
}

export async function importAppData(storage, data) {
   if (!storage?.db) {
      await storage.init();
   }

   if (!isBackupPayload(data)) {
      throw new Error('Respaldo inválido.');
   }

   for (const storeName of STORE_NAMES) {
      await storage.clearStore(storeName);
      const items = data.stores[storeName] ?? [];
      for (const item of items) {
         if (!item || typeof item !== 'object' || item.id == null) {
            continue;
         }
         await storage.put(storeName, item);
      }
   }

   await reloadAllServicesFromStorage();
}

export async function reloadAllServicesFromStorage() {
   const serviceIds = [
      'domain-service',
      'task-service',
      'time-block-service',
      'payment-method-service',
      'finance-service',
      'shopping-service',
      'profile-service',
      'notes-service',
      'vision-service'
   ];

   for (const serviceId of serviceIds) {
      const service = slice.getComponent(serviceId);
      if (typeof service?.syncToContext === 'function') {
         await service.syncToContext();
      }
   }

   slice.events.emit('data:restored');
}
