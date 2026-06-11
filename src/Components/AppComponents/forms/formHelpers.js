export function getService(sliceId, methods = []) {
   const service = slice.getComponent(sliceId);
   if (!service) {
      return null;
   }

   for (const method of methods) {
      if (typeof service[method] !== 'function') {
         return null;
      }
   }

   return service;
}

export function closeModal() {
   const shell = slice.getComponent('modal-shell');
   if (typeof shell?.close === 'function') {
      shell.close();
      return;
   }
   slice.events.emit('ui:modal:close');
}

export function showFormError(el, message) {
   if (!el) {
      return;
   }
   el.textContent = message;
   el.hidden = false;
}

export function hideFormError(el) {
   if (!el) {
      return;
   }
   el.hidden = true;
}

export async function buildModalButtons(form, { submitLabel = 'Guardar', onSubmit } = {}) {
   form.$actions.innerHTML = '';

   const cancelBtn = await slice.build('Button', {
      sliceId: `${form.sliceId}-cancel`,
      value: 'Cancelar',
      variant: 'outlined',
      onClick: () => closeModal()
   });
   const submitBtn = await slice.build('Button', {
      sliceId: `${form.sliceId}-submit`,
      value: submitLabel,
      variant: 'filled',
      onClick: () => {
         if (typeof onSubmit === 'function') {
            onSubmit();
            return;
         }
         form.$form?.requestSubmit();
      }
   });

   if (cancelBtn) {
      form.$actions.appendChild(cancelBtn);
   }
   if (submitBtn) {
      form.$actions.appendChild(submitBtn);
   }

   return Boolean(cancelBtn && submitBtn);
}
