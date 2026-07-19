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

   paymentMethods() {
      return slice.getComponent('payment-method-service');
   }

   async syncToContext() {
      const finances = await this.storage.getAll(STORE);
      finances.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

      const methods = this.paymentMethods()?.getAll?.() ?? [];
      const walletBalance =
         methods.length > 0
            ? methods.reduce((sum, method) => sum + (Number(method.balance) || 0), 0)
            : await this.getWalletBalanceRaw();

      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         finances,
         walletBalance
      }));
   }

   getAll() {
      return slice.context.getState('lifeControl')?.finances ?? [];
   }

   getById(id) {
      return this.getAll().find((item) => item.id === id) ?? null;
   }

   getWalletBalance() {
      return slice.context.getState('lifeControl')?.walletBalance ?? 0;
   }

   async getWalletBalanceRaw() {
      const items = await this.storage.getAll(META_STORE);
      const wallet = items.find((item) => item.id === WALLET_ID);
      return Number(wallet?.balance) || 0;
   }

   resolveAccountId(accountId) {
      const pm = this.paymentMethods();
      if (!pm) {
         return null;
      }
      if (accountId && pm.getById(accountId)) {
         return accountId;
      }
      return pm.getDefaultId();
   }

   async setWalletBalance(balance) {
      const pm = this.paymentMethods();
      const methods = pm?.getAll?.() ?? [];
      if (methods.length === 1) {
         await pm.setBalance(methods[0].id, balance);
         return Number(balance) || 0;
      }
      if (methods.length > 1) {
         throw new Error('Ajusta el saldo desde cada método de pago.');
      }

      const value = Number(balance) || 0;
      await this.storage.put(META_STORE, { id: WALLET_ID, balance: value });
      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         walletBalance: value
      }));
      slice.events.emit('finance:changed', { action: 'wallet', balance: value });
      return value;
   }

   async adjustAccount(accountId, delta) {
      const pm = this.paymentMethods();
      const id = this.resolveAccountId(accountId);
      if (pm && id) {
         await pm.adjustBalance(id, delta);
         await this.syncToContext();
         return;
      }
      const current = await this.getWalletBalanceRaw();
      await this.setWalletBalance(current + delta);
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
      const today = new Date().toISOString().slice(0, 10);
      return this.getAll().filter((item) => {
         if (item.settled || !item.dueDate) {
            return false;
         }
         if (item.dueDate === isoDate) {
            return true;
         }
         return item.dueDate < isoDate && isoDate >= today;
      });
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

   async create({ description, amount, type, dueDate = null, domainId = null, accountId = null }) {
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
         domainId: domainId || null,
         accountId: this.resolveAccountId(accountId),
         settled: false,
         createdAt: new Date().toISOString()
      };

      await this.storage.put(STORE, item);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'create', item });
      return item;
   }

   async update(id, patch) {
      const items = await this.storage.getAll(STORE);
      const existing = items.find((item) => item.id === id);
      if (!existing) {
         return null;
      }

      const oldAmount = Number(existing.amount) || 0;
      const description = patch.description?.trim() ?? existing.description;
      const amount = patch.amount !== undefined ? Number(patch.amount) : oldAmount;
      const type =
         patch.type === FINANCE_TYPE.RECEIVE
            ? FINANCE_TYPE.RECEIVE
            : patch.type === FINANCE_TYPE.PAY
              ? FINANCE_TYPE.PAY
              : existing.type;
      const dueDate = patch.dueDate !== undefined ? patch.dueDate || null : existing.dueDate ?? null;
      const domainId = patch.domainId !== undefined ? patch.domainId || null : existing.domainId ?? null;
      const accountId =
         patch.accountId !== undefined
            ? this.resolveAccountId(patch.accountId)
            : existing.accountId ?? this.resolveAccountId(null);

      if (!description || !Number.isFinite(amount) || amount <= 0) {
         return null;
      }

      if (existing.settled) {
         const oldAccount = existing.accountId ?? this.resolveAccountId(null);
         const oldEffect = existing.type === FINANCE_TYPE.RECEIVE ? oldAmount : -oldAmount;
         const newEffect = type === FINANCE_TYPE.RECEIVE ? amount : -amount;

         if (oldAccount !== accountId) {
            await this.adjustAccount(oldAccount, -oldEffect);
            await this.adjustAccount(accountId, newEffect);
         } else if (amount !== oldAmount || type !== existing.type) {
            await this.adjustAccount(accountId, newEffect - oldEffect);
         }
      }

      const updated = {
         ...existing,
         description,
         amount,
         type,
         dueDate,
         domainId,
         accountId
      };

      await this.storage.put(STORE, updated);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'update', item: updated });
      return updated;
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

      const accountId = existing.accountId ?? this.resolveAccountId(null);
      const updated = {
         ...existing,
         accountId,
         settled: willBeSettled,
         settledAt: willBeSettled ? new Date().toISOString().slice(0, 10) : null
      };
      await this.storage.put(STORE, updated);
      await this.adjustAccount(accountId, this.walletDeltaFor(existing, willBeSettled));
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
         const accountId = existing.accountId ?? this.resolveAccountId(null);
         await this.adjustAccount(accountId, this.walletDeltaFor(existing, false));
      }

      await this.storage.delete(STORE, id);
      await this.syncToContext();
      slice.events.emit('finance:changed', { action: 'delete', id });
      return true;
   }
}
