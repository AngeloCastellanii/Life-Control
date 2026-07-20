import { PAYMENT_METHOD_COLORS } from '../../AppComponents/sections/paymentMethodColors.js';

const STORE = 'paymentMethods';
const DEFAULT_COLORS = PAYMENT_METHOD_COLORS;

function normalize(method) {
   return {
      id: method.id,
      name: (method.name ?? '').trim(),
      balance: Number(method.balance) || 0,
      color: method.color || DEFAULT_COLORS[0],
      order: Number.isFinite(method.order) ? method.order : 0,
      isPool: Boolean(method.isPool),
      createdAt: method.createdAt ?? new Date().toISOString()
   };
}

function roundMoney(value) {
   return Math.round((Number(value) || 0) * 100) / 100;
}

export default class PaymentMethodService {
   async init() {
      this.storage = slice.getComponent('storage-service');
      if (!this.storage) {
         throw new Error('StorageService no está disponible');
      }
      if (!this.storage.db) {
         await this.storage.init();
      }
      // No se crean métodos automáticamente: solo los que agregue el usuario.
      await this.syncToContext();
   }

   async readLegacyWallet() {
      try {
         const meta = await this.storage.getAll('meta');
         const wallet = meta.find((item) => item.id === 'wallet');
         return Number(wallet?.balance) || 0;
      } catch {
         return 0;
      }
   }

   async syncToContext() {
      const paymentMethods = (await this.storage.getAll(STORE)).map(normalize);
      paymentMethods.sort((a, b) => {
         if (a.isPool !== b.isPool) {
            return a.isPool ? -1 : 1;
         }
         return a.order - b.order || a.name.localeCompare(b.name);
      });

      let walletBalance = paymentMethods.reduce((sum, method) => sum + (Number(method.balance) || 0), 0);

      // Sin métodos: respetar el saldo legado de meta (no inventar cuentas).
      if (paymentMethods.length === 0) {
         walletBalance = await this.readLegacyWallet();
      } else {
         try {
            await this.storage.put('meta', { id: 'wallet', balance: walletBalance });
         } catch {
            /* ignore */
         }
      }

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         paymentMethods,
         walletBalance
      }));
   }

   getAll() {
      return (slice.context.getState('lifeControl')?.paymentMethods ?? []).map(normalize);
   }

   getById(id) {
      if (!id) {
         return null;
      }
      return this.getAll().find((method) => method.id === id) ?? null;
   }

   getPool() {
      return this.getAll().find((method) => method.isPool) ?? null;
   }

   /** @deprecated alias de getPool */
   getGeneral() {
      return this.getPool();
   }

   getDefaultId() {
      return this.getPool()?.id ?? this.getAll()[0]?.id ?? null;
   }

   getTotalBalance() {
      return this.getAll().reduce((sum, method) => sum + (Number(method.balance) || 0), 0);
   }

   getLegacyWalletBalance() {
      return Number(slice.context.getState('lifeControl')?.walletBalance) || 0;
   }

   async writeRaw(method) {
      await this.storage.put(STORE, normalize(method));
   }

   /**
    * Si hay un método marcado como fondo (isPool), mueve dinero desde/hacia él.
    * Si no hay fondo, no hace nada al aumentar (dinero nuevo) o al disminuir (solo baja el método).
    */
   async transferFromPool(delta, excludeId = null) {
      const amount = roundMoney(delta);
      if (amount === 0) {
         return { moved: 0 };
      }

      const pool = this.getPool();
      if (!pool || (excludeId && pool.id === excludeId)) {
         return { moved: 0 };
      }

      if (amount > 0) {
         const fromPool = roundMoney(Math.min(amount, Math.max(0, pool.balance)));
         if (fromPool <= 0) {
            return { moved: 0 };
         }
         await this.writeRaw({
            ...pool,
            balance: roundMoney(pool.balance - fromPool)
         });
         return { moved: fromPool };
      }

      await this.writeRaw({
         ...pool,
         balance: roundMoney(pool.balance - amount)
      });
      return { moved: amount };
   }

   async create({ name, balance = 0, color, isPool = false }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const amount = roundMoney(balance);
      if (amount < 0) {
         throw new Error('El saldo no puede ser negativo.');
      }

      const existing = this.getAll();
      let asPool = Boolean(isPool);

      // Solo un fondo a la vez.
      if (asPool) {
         for (const method of existing.filter((item) => item.isPool)) {
            await this.writeRaw({ ...method, isPool: false });
         }
      }

      if (!asPool) {
         await this.transferFromPool(amount);
      }

      const method = normalize({
         id: crypto.randomUUID(),
         name: trimmed,
         balance: amount,
         color: color || DEFAULT_COLORS[existing.length % DEFAULT_COLORS.length],
         order: existing.length,
         isPool: asPool,
         createdAt: new Date().toISOString()
      });

      await this.writeRaw(method);
      await this.syncToContext();
      slice.events.emit('payment-method:changed', { action: 'create', method });
      return method;
   }

   async update(id, patch) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const name = patch.name !== undefined ? String(patch.name).trim() : existing.name;
      if (!name) {
         return null;
      }

      let isPool = existing.isPool;
      if (patch.isPool !== undefined) {
         isPool = Boolean(patch.isPool);
      }

      if (isPool && !existing.isPool) {
         for (const method of this.getAll().filter((item) => item.isPool && item.id !== id)) {
            await this.writeRaw({ ...method, isPool: false });
         }
      }

      let balance = existing.balance;
      if (patch.balance !== undefined) {
         balance = roundMoney(patch.balance);
         if (balance < 0) {
            throw new Error('El saldo no puede ser negativo.');
         }

         if (!isPool && !existing.isPool) {
            const delta = roundMoney(balance - existing.balance);
            await this.transferFromPool(delta, id);
         }
      }

      const updated = normalize({
         ...existing,
         ...patch,
         id,
         name,
         balance,
         isPool,
         color: patch.color ?? existing.color
      });

      await this.writeRaw(updated);
      await this.syncToContext();
      slice.events.emit('payment-method:changed', { action: 'update', method: updated });
      return updated;
   }

   async setBalance(id, balance) {
      return this.update(id, { balance: Number(balance) || 0 });
   }

   async adjustBalance(id, delta) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }
      const next = roundMoney((Number(existing.balance) || 0) + (Number(delta) || 0));
      await this.writeRaw({ ...existing, balance: next });
      await this.syncToContext();
      slice.events.emit('payment-method:changed', { action: 'adjust', method: { ...existing, balance: next } });
      return this.getById(id);
   }

   async remove(id) {
      const existing = this.getById(id);
      if (!existing) {
         return false;
      }

      const pool = this.getPool();
      if (!existing.isPool && pool && pool.id !== id) {
         await this.transferFromPool(-roundMoney(existing.balance), id);
      }

      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('payment-method:changed', { action: 'delete', id });
      return true;
   }
}
