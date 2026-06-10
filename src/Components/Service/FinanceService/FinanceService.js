const STORE = 'finances';
const META_STORE = 'meta';
const WALLET_ID = 'wallet';

export const FINANCE_TYPE = {
   PAY: 'pay',
   RECEIVE: 'receive'
};

export default class FinanceService {
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
      const finances = await this.storage.getAll(STORE);
      finances.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

      const walletBalance = await this.getWalletBalanceRaw();

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         finances,
         walletBalance
      }));
   }

   getAll() {
      return slice.context.getState('lifeControl')?.finances ?? [];
   }

   getWalletBalance() {
      return slice.context.getState('lifeControl')?.walletBalance ?? 0;
   }

   async getWalletBalanceRaw() {
      const items = await this.storage.getAll(META_STORE);
      const wallet = items.find((item) => item.id === WALLET_ID);
      return Number(wallet?.balance) || 0;
   }

   async setWalletBalance(balance) {
      const value = Number(balance) || 0;
      await this.storage.put(META_STORE, { id: WALLET_ID, balance: value });
      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         walletBalance: value
      }));
      slice.events.emit('finance:changed', { action: 'wallet', balance: value });
      return value;
   }

   async adjustWallet(delta) {
      const current = await this.getWalletBalanceRaw();
      return this.setWalletBalance(current + delta);
   }

   getByType(type) {
      return this.getAll().filter((item) => item.type === type);
   }

   pendingTotal(type) {
      return this.getByType(type)
         .filter((item) => !item.settled)
         .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
   }

   getDueOnDate(isoDate) {
      return this.getAll().filter((item) => !item.settled && item.dueDate === isoDate);
   }

   getUpcoming({ withinDays = 7, fromDate = null } = {}) {
      const from = fromDate ?? new Date().toISOString().slice(0, 10);
      const end = new Date(`${from}T12:00:00`);
      end.setDate(end.getDate() + withinDays);
      const endISO = end.toISOString().slice(0, 10);

      return this.getAll()
         .filter((item) => !item.settled && item.dueDate && item.dueDate >= from && item.dueDate <= endISO)
         .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
   }

   walletDeltaFor(item, settled) {
      const amount = Number(item.amount) || 0;
      if (item.type === FINANCE_TYPE.RECEIVE) {
         return settled ? amount : -amount;
      }
      return settled ? -amount : amount;
   }

   async create({ description, amount, type, dueDate = null }) {
      const trimmed = description?.trim();
      const value = Number(amount);
      if (!trimmed || !Number.isFinite(value) || value <= 0) {
         return null;
      }

      const item = {
         id: crypto.randomUUID(),
         description: trimmed,
         amount: value,
         type: type === FINANCE_TYPE.RECEIVE ? FINANCE_TYPE.RECEIVE : FINANCE_TYPE.PAY,
         dueDate: dueDate || null,
         settled: false,
         createdAt: new Date().toISOString()
      };

      await this.storage.put(STORE, item);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'create', item });
      return item;
   }

   async toggleSettled(id, settled) {
      const items = await this.storage.getAll(STORE);
      const existing = items.find((item) => item.id === id);
      if (!existing) {
         return null;
      }

      const wasSettled = !!existing.settled;
      const willBeSettled = !!settled;
      if (wasSettled === willBeSettled) {
         return existing;
      }

      const updated = { ...existing, settled: willBeSettled };
      await this.storage.put(STORE, updated);
      await this.adjustWallet(this.walletDeltaFor(existing, willBeSettled));
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'update', item: updated });
      return updated;
   }

   async remove(id) {
      const items = await this.storage.getAll(STORE);
      const existing = items.find((item) => item.id === id);
      if (!existing) {
         return false;
      }

      if (existing.settled) {
         await this.adjustWallet(this.walletDeltaFor(existing, false));
      }

      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'delete', id });
      return true;
   }
}
