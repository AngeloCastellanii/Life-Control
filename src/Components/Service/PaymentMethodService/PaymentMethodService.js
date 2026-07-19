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
      createdAt: method.createdAt ?? new Date().toISOString()
   };
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
      await this.migrateFromWallet();
      await this.syncToContext();
   }

   async migrateFromWallet() {
      const existing = await this.storage.getAll(STORE);
      if (existing.length > 0) {
         return;
      }

      let walletBalance = 0;
      try {
         const meta = await this.storage.getAll('meta');
         const wallet = meta.find((item) => item.id === 'wallet');
         walletBalance = Number(wallet?.balance) || 0;
      } catch {
         /* ignore */
      }

      await this.storage.put(STORE, normalize({
         id: crypto.randomUUID(),
         name: 'General',
         balance: walletBalance,
         color: DEFAULT_COLORS[0],
         order: 0,
         createdAt: new Date().toISOString()
      }));
   }

   async syncToContext() {
      const paymentMethods = (await this.storage.getAll(STORE)).map(normalize);
      paymentMethods.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

      const walletBalance = paymentMethods.reduce((sum, method) => sum + (Number(method.balance) || 0), 0);

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         paymentMethods,
         walletBalance
      }));

      try {
         await this.storage.put('meta', { id: 'wallet', balance: walletBalance });
      } catch {
         /* ignore */
      }
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

   getDefaultId() {
      return this.getAll()[0]?.id ?? null;
   }

   getTotalBalance() {
      return this.getAll().reduce((sum, method) => sum + (Number(method.balance) || 0), 0);
   }

   async create({ name, balance = 0, color }) {
      const trimmed = name?.trim();
      if (!trimmed) {
         return null;
      }

      const method = normalize({
         id: crypto.randomUUID(),
         name: trimmed,
         balance: Number(balance) || 0,
         color: color || DEFAULT_COLORS[this.getAll().length % DEFAULT_COLORS.length],
         order: this.getAll().length,
         createdAt: new Date().toISOString()
      });

      await this.storage.put(STORE, method);
      await this.syncToContext();
      slice.events.emit('payment-method:changed', { action: 'create', method });
      return method;
   }

   async update(id, patch) {
      const existing = this.getById(id);
      if (!existing) {
         return null;
      }

      const updated = normalize({
         ...existing,
         ...patch,
         id,
         name: patch.name?.trim() ?? existing.name,
         balance: patch.balance !== undefined ? Number(patch.balance) || 0 : existing.balance
      });

      if (!updated.name) {
         return null;
      }

      await this.storage.put(STORE, updated);
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
      return this.setBalance(id, (Number(existing.balance) || 0) + (Number(delta) || 0));
   }

   async remove(id) {
      const methods = this.getAll();
      if (methods.length <= 1) {
         throw new Error('Debes conservar al menos un método de pago.');
      }
      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('payment-method:changed', { action: 'delete', id });
      return true;
   }
}

