import { getPreferredCurrency } from '../../AppComponents/sections/currency.js';

const API_URL = 'https://open.er-api.com/v6/latest/USD';

export default class ExchangeRateService {
   async init() {
      this.syncToContext({ status: 'idle', rate: null, target: getPreferredCurrency(), message: null });
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

         this.syncToContext({
            status: 'success',
            rate,
            target,
            base: 'USD',
            message: null
         });
         slice.events.emit('exchange-rate:updated', { rate, target });
         return { rate, target };
      } catch (error) {
         this.syncToContext({
            status: 'error',
            message: error.message ?? 'No se pudo obtener el tipo de cambio'
         });
         return null;
      }
   }
}
