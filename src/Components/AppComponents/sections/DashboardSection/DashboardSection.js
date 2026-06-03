export default class DashboardSection extends HTMLElement {
   static props = {
      sliceId: { type: 'string', default: 'dashboard-section' },
      params: { type: 'object', default: {} },
      metadata: { type: 'object', default: {} }
   };

   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$capacityMount = this.querySelector('[data-role="capacity-ring"]');
      this.$tasksCount = this.querySelector('[data-role="tasks-count"]');
      this.$rate = this.querySelector('[data-role="rate"]');
      this.$rateRetry = this.querySelector('[data-role="rate-retry"]');
      this.$priorityList = this.querySelector('[data-role="priority-list"]');
      this.$priorityEmpty = this.querySelector('[data-role="priority-empty"]');
      this.$recentList = this.querySelector('[data-role="recent-list"]');
      this.$recentEmpty = this.querySelector('[data-role="recent-empty"]');
      this._capacityRing = null;
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');
      this.timeBlockService = slice.getComponent('time-block-service');
      this.exchangeRateService = slice.getComponent('exchange-rate-service');

      this._capacityRing = await slice.build('CapacityRing', {
         sliceId: 'dashboard-capacity-ring',
         percent: 0
      });
      this.$capacityMount.appendChild(this._capacityRing);

      this.$rateRetry.addEventListener('click', () => {
         this.exchangeRateService?.fetchRate();
      });

      slice.context.watch(
         'lifeControl',
         this,
         (data) => this.refresh(data),
         (state) => ({
            tasks: state?.tasks ?? [],
            timeBlocks: state?.timeBlocks ?? [],
            exchangeRate: state?.exchangeRate ?? {}
         })
      );

      this.refresh({
         tasks: this.taskService?.getAll() ?? [],
         timeBlocks: this.timeBlockService?.getAll() ?? [],
         exchangeRate: slice.context.getState('lifeControl')?.exchangeRate ?? {}
      });
   }

   refresh({ tasks, timeBlocks, exchangeRate }) {
      const pending = tasks.filter((t) => !t.completed);
      this.$tasksCount.textContent = String(pending.length);

      const totalCapacity = timeBlocks.reduce((sum, b) => sum + (b.duration ?? 0), 0);
      const usedCapacity = tasks
         .filter((t) => t.blockId && t.completed)
         .reduce((sum, t) => sum + (t.minutes ?? 0), 0);
      const percent = totalCapacity ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

      if (this._capacityRing) {
         this._capacityRing.percent = percent;
      }

      this.renderRate(exchangeRate);
      this.renderLists(pending);
   }

   renderRate(exchangeRate) {
      const status = exchangeRate?.status ?? 'idle';

      if (status === 'loading') {
         this.$rate.textContent = 'Cargando…';
         this.$rateRetry.hidden = true;
         return;
      }

      if (status === 'error') {
         this.$rate.textContent = 'Error';
         this.$rateRetry.hidden = false;
         return;
      }

      if (status === 'success' && exchangeRate.rate) {
         this.$rate.textContent = `1 USD = ${exchangeRate.rate.toFixed(2)} ${exchangeRate.target}`;
         this.$rateRetry.hidden = true;
         return;
      }

      this.$rate.textContent = '—';
      this.$rateRetry.hidden = true;
   }

   renderLists(tasks) {
      const urgent = tasks.filter((t) => t.urgency === 'high').slice(0, 5);
      const recent = tasks.filter((t) => t.blockId).slice(0, 5);

      this.fillList(this.$priorityList, urgent);
      this.$priorityEmpty.hidden = urgent.length > 0;

      this.fillList(this.$recentList, recent);
      this.$recentEmpty.hidden = recent.length > 0;
   }

   fillList(listEl, tasks) {
      listEl.innerHTML = '';
      for (const task of tasks) {
         const item = document.createElement('li');
         item.className = 'dashboard-section__list-item';
         item.textContent = task.title;
         listEl.appendChild(item);
      }
   }
}

customElements.define('slice-dashboard-section', DashboardSection);
