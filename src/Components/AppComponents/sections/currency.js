const STORAGE_KEY = 'lc_currency';
const DEFAULT_CURRENCY = 'VES';

export const CURRENCIES = [
   { code: 'VES', label: 'Bolívares (Bs)' },
   { code: 'EUR', label: 'Euro (€)' },
   { code: 'USD', label: 'Dólar (US$)' }
];

export function getPreferredCurrency() {
   try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY;
   } catch {
      return DEFAULT_CURRENCY;
   }
}

export function setPreferredCurrency(code) {
   try {
      localStorage.setItem(STORAGE_KEY, code || DEFAULT_CURRENCY);
   } catch {
      /* ignore */
   }
}
