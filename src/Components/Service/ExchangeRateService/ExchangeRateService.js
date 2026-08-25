import { getPreferredCurrency } from '../../AppComponents/sections/currency.js';

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const STORAGE_KEY = 'lc_exchange_rate';

function readCachedRate() {
   try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
         return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed?.rate || !parsed?.target) {
         return null;
      }
      return parsed;
   } catch {
      return null;
   }
}

function writeCachedRate(payload) {
   try {
      localStorage.setItem(
         STORAGE_KEY,
         JSON.stringify({
            rate: payload.rate,
            target: payload.target,
            base: payload.base || 'USD',
            updatedAt: payload.updatedAt ?? Date.now()
         })
      );
   } catch {
      /* ignore */
   }
}

export default class ExchangeRateService {
   async init() {
      const cached = readCachedRate();
      if (cached) {
         this.syncToContext({
            status: 'success',
            rate: cached.rate,
            target: cached.target,
            base: cached.base || 'USD',
            stale: true,
            message: null,
            updatedAt: cached.updatedAt
         });
      } else {
         this.syncToContext({
            status: 'idle',
            rate: null,
            target: getPreferredCurrency(),
            stale: false,
            message: null
         });
      }
      await this.fetchRate();
   }

   syncToContext(exchangeRate) {
      slice.context.setState('lifeControl', (prev) => ({
         ...(prev ?? {}),
         exchangeRate: {
            ...(prev?.exchangeRate ?? {}),
            ...exchangeRate,
            updatedAt: exchangeRate.updatedAt ?? Date.now()
         }
      }));
   }

   applyCachedFallback(errorMessage) {
      const cached = readCachedRate();
      const previous = slice.context.getState('lifeControl')?.exchangeRate;
      const rate = cached?.rate ?? previous?.rate ?? null;
      const target = cached?.target ?? previous?.target ?? getPreferredCurrency();
      if (rate) {
         this.syncToContext({
            status: 'success',
            rate,
            target,
            base: cached?.base ?? previous?.base ?? 'USD',
            stale: true,
            message: errorMessage || 'Sin conexión · última tasa conocida',
            updatedAt: cached?.updatedAt ?? previous?.updatedAt
         });
         return { rate, target, stale: true };
      }
      this.syncToContext({
         status: 'error',
         message: errorMessage ?? 'No se pudo obtener el tipo de cambio',
         stale: false
      });
      return null;
   }

   async fetchRate() {
      this.syncToContext({ status: 'loading', message: null });

      try {
         const response = await fetch(API_URL);
         if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
         }

         const data = await response.json();
         const preferred = getPreferredCurrency();
         const target = data.rates?.[preferred]
            ? preferred
            : data.rates?.VES
              ? 'VES'
              : 'EUR';
         const rate = data.rates?.[target];

         if (!rate) {
            throw new Error('Moneda no disponible en la respuesta');
         }

         const updatedAt = Date.now();
         writeCachedRate({ rate, target, base: 'USD', updatedAt });
         this.syncToContext({
            status: 'success',
            rate,
            target,
            base: 'USD',
            stale: false,
            message: null,
            updatedAt
         });
         slice.events.emit('exchange-rate:updated', { rate, target });
         return { rate, target };
      } catch (error) {
         return this.applyCachedFallback(error.message ?? 'No se pudo obtener el tipo de cambio');
      }
   }
}
