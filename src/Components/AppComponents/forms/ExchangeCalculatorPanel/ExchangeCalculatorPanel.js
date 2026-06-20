export default class ExchangeCalculatorPanel extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'exchange-calculator-panel' }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$rateLabel = this.querySelector('[data-role="rate-label"]');
      this.$usdInput = this.querySelector('[data-role="usd-input"]');
      this.$localInput = this.querySelector('[data-role="local-input"]');
      this.$output = this.querySelector('[data-role="output"]');
      this.$currency = this.querySelector('[data-role="currency"]');
      this._updating = false;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.$usdInput.addEventListener('input', () => this.fromUsd());
      this.$localInput.addEventListener('input', () => this.fromLocal());

      slice.context.watch(
         'lifeControl',
         this,
         () => this.paintRate(),
         (state) => ({ exchangeRate: state?.exchangeRate ?? {} })
      );

      this.paintRate();
      this.$usdInput.value = '10';
      this.fromUsd();
      this.$usdInput.focus();
   }

   rateInfo() {
      const exchangeRate = slice.context.getState('lifeControl')?.exchangeRate ?? {};
      if (exchangeRate.status !== 'success' || !exchangeRate.rate) {
         return null;
      }
      return { rate: Number(exchangeRate.rate), target: exchangeRate.target ?? 'VES' };
   }

   paintRate() {
      const info = this.rateInfo();
      if (!info) {
         this.$rateLabel.textContent = 'Tasa no disponible.';
         this.$currency.textContent = '';
         return;
      }
      this.$rateLabel.textContent = `1 USD = ${info.rate.toFixed(2)} ${info.target}`;
      this.$currency.textContent = info.target;
   }

   fromUsd() {
      if (this._updating) {
         return;
      }
      const info = this.rateInfo();
      if (!info) {
         return;
      }
      const usd = Number(String(this.$usdInput.value).replace(',', '.'));
      if (!Number.isFinite(usd) || usd < 0) {
         this.$output.textContent = '0.00';
         this._updating = true;
         this.$localInput.value = '';
         this._updating = false;
         return;
      }
      const local = usd * info.rate;
      this.$output.textContent = local.toFixed(2);
      this._updating = true;
      this.$localInput.value = local ? local.toFixed(2) : '';
      this._updating = false;
   }

   fromLocal() {
      if (this._updating) {
         return;
      }
      const info = this.rateInfo();
      if (!info) {
         return;
      }
      const local = Number(String(this.$localInput.value).replace(',', '.'));
      if (!Number.isFinite(local) || local < 0) {
         this.$output.textContent = '0.00';
         this._updating = true;
         this.$usdInput.value = '';
         this._updating = false;
         return;
      }
      const usd = local / info.rate;
      this.$output.textContent = local.toFixed(2);
      this._updating = true;
      this.$usdInput.value = usd ? usd.toFixed(2) : '';
      this._updating = false;
   }
}

customElements.define('slice-exchange-calculator-panel', ExchangeCalculatorPanel);
