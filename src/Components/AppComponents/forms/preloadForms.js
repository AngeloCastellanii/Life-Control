const MODAL_FORMS = [
   'BlockForm',
   'TaskForm',
   'FinanceForm',
   'ShoppingForm',
   'DomainForm',
   'WalletForm'
];

export async function preloadModalForms() {
   await Promise.all(MODAL_FORMS.map((name) => warmFormComponent(name)));
}

async function warmFormComponent(componentName) {
   const category = slice.controller.componentCategories.get(componentName);
   if (!category) {
      return;
   }

   const basePath = slice.paths.components[category]?.path;
   if (!basePath) {
      return;
   }

   const modulePath = `${basePath}/${componentName}/${componentName}.js`;

   if (!slice.controller.classes.has(componentName)) {
      const ComponentClass = await slice.getClass(modulePath);
      if (ComponentClass && typeof ComponentClass === 'function') {
         slice.controller.classes.set(componentName, ComponentClass);
      }
   }

   if (!slice.controller.templates.has(componentName)) {
      try {
         const html = await slice.controller.fetchText(componentName, 'html', category);
         if (html || html === '') {
            const template = document.createElement('template');
            template.innerHTML = html;
            slice.controller.templates.set(componentName, template);
         }
      } catch (error) {
         console.warn(`No se pudo precargar template de ${componentName}`, error);
      }
   }
}
