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

function formActionsEl(form) {
   return form.querySelector('[data-role="actions"]');
}

function formEl(form) {
   return form.querySelector('[data-role="form"]');
}

export async function buildModalButtons(form, options = {}) {
   const { submitLabel = 'Guardar', onSubmit } = options;
   const actions = formActionsEl(form);
   if (!actions) {
      return false;
   }

   actions.innerHTML = '';
   const formKey = form.sliceId || form.constructor?.name || 'form';

   const cancelBtn = await slice.build('Button', {
      ['sliceId']: `${formKey}-cancel`,
      value: 'Cancelar',
      variant: 'outlined',
      ['onClick']: () => closeModal()
   });
   const submitBtn = await slice.build('Button', {
      ['sliceId']: `${formKey}-submit`,
      value: submitLabel,
      variant: 'filled',
      ['onClick']: () => {
         if (typeof onSubmit === 'function') {
            onSubmit();
            return;
         }
         formEl(form)?.requestSubmit();
      }
   });

   if (cancelBtn) {
      actions.appendChild(cancelBtn);
   }
   if (submitBtn) {
      actions.appendChild(submitBtn);
   }

   return Boolean(cancelBtn && submitBtn);
}
