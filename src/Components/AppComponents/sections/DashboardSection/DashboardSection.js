export default class DashboardSection extends HTMLElement {
   constructor(props) {
      super();
      slice.attachTemplate(this);
      this.$tasksCount = this.querySelector('[data-role="tasks-count"]');
      slice.controller.setComponentProps(this, props);
   }

   async init() {
      this.taskService = slice.getComponent('task-service');

      slice.context.watch(
         'lifeControl',
         this,
         (data) => this.updateKpis(data),
         (state) => ({
            tasks: (state?.tasks ?? []).filter((t) => !t.completed).length
         })
      );

      const pending = this.taskService?.getAll().filter((t) => !t.completed).length ?? 0;
      this.updateKpis({ tasks: pending });
   }

   updateKpis({ tasks }) {
      if (this.$tasksCount) {
         this.$tasksCount.textContent = String(tasks ?? 0);
      }
   }
}

customElements.define('slice-dashboard-section', DashboardSection);
