export const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 20h4l10.5-10.5-4-4L4 16v4z" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke-linecap="round"/></svg>`;

export const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>`;

export const ICON_CHEVRON_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const ICON_CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function paintIconButton(button, kind) {
   button.classList.add('lc-icon-btn');
   if (kind === 'delete') {
      button.classList.add('lc-icon-btn--danger');
   }
   const icons = {
      edit: ICON_EDIT,
      delete: ICON_DELETE,
      close: ICON_CLOSE,
      prev: ICON_CHEVRON_LEFT,
      next: ICON_CHEVRON_RIGHT
   };
   button.innerHTML = icons[kind] || ICON_EDIT;
}
