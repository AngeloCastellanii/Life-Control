const CIRCUMFERENCE = 2 * Math.PI * 34;

export default class CapacityRing extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'capacity-ring' },
      percent: { type: 'number', default: 0 }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$progress = this.querySelector('[data-role="progress"]');
      this.$value = this.querySelector('[data-role="value"]');
      slice.controller.setComponentProps(this, props);
   }

   init() {
      this.paint();
   }

   paint() {
      const percent = Math.min(100, Math.max(0, Number(this.percent) || 0));
      const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
      this.$progress.style.strokeDashoffset = String(offset);
      this.$value.textContent = `${Math.round(percent)}%`;
      this.classList.toggle('capacity-ring--full', percent >= 100);
   }

   async update() {
      this.paint();
   }

   set percent(value) {
      this._percent = value;
      this.paint();
   }

   get percent() {
      return this._percent ?? 0;
   }
}

customElements.define('slice-capacity-ring', CapacityRing);
