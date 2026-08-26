const STORAGE_KEY = 'lc_nav_views_v1';

export const NAV_CATALOG = [
   { id: 'dashboard', path: '/', text: 'Dashboard', locked: 'start' },
   { id: 'planner', path: '/planner', text: 'Planificador' },
   { id: 'finances', path: '/finances', text: 'Finanzas' },
   { id: 'shopping', path: '/shopping', text: 'Compras' },
   { id: 'notes', path: '/notes', text: 'Notas' },
   { id: 'habits', path: '/habits', text: 'Hábitos' },
   { id: 'vision', path: '/vision', text: 'Vision Board' },
   { id: 'settings', path: '/settings', text: 'Perfil', locked: 'end' }
];

const DEFAULT_ORDER = NAV_CATALOG.map((item) => item.id);

function catalogById() {
   return Object.fromEntries(NAV_CATALOG.map((item) => [item.id, item]));
}

function readPrefs() {
   try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && Array.isArray(parsed.order)) {
         return {
            order: parsed.order.filter((id) => catalogById()[id]),
            hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => catalogById()[id]) : []
         };
      }
   } catch {
      /* ignore */
   }
   return { order: [...DEFAULT_ORDER], hidden: [] };
}

function writePrefs(prefs) {
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
   } catch {
      /* ignore */
   }
}

export function getNavPrefs() {
   const catalog = catalogById();
   const prefs = readPrefs();
   const seen = new Set();
   const order = [];
   for (const id of prefs.order) {
      if (catalog[id] && !seen.has(id)) {
         order.push(id);
         seen.add(id);
      }
   }
   for (const item of NAV_CATALOG) {
      if (!seen.has(item.id)) {
         order.push(item.id);
      }
   }
   const hidden = prefs.hidden.filter((id) => catalog[id]?.locked == null);
   return { order, hidden };
}

export function setNavPrefs(next) {
   const catalog = catalogById();
   const order = [];
   const seen = new Set();
   for (const id of next.order ?? []) {
      if (catalog[id] && !seen.has(id)) {
         order.push(id);
         seen.add(id);
      }
   }
   for (const item of NAV_CATALOG) {
      if (!seen.has(item.id)) {
         order.push(item.id);
      }
   }
   const hidden = (next.hidden ?? []).filter((id) => catalog[id]?.locked == null);
   writePrefs({ order, hidden });
   slice.events?.emit?.('nav:items-changed', { order, hidden });
   return { order, hidden };
}

export function getNavItems() {
   const { order, hidden } = getNavPrefs();
   const catalog = catalogById();
   const hiddenSet = new Set(hidden);
   return order
      .map((id) => catalog[id])
      .filter((item) => item && !hiddenSet.has(item.id))
      .map((item) => ({ id: item.id, path: item.path, text: item.text }));
}

export function getNavPaths() {
   return getNavItems().map((item) => item.path);
}

export function moveNavView(id, direction) {
   const catalog = catalogById();
   const item = catalog[id];
   if (!item || item.locked) {
      return getNavPrefs();
   }
   const prefs = getNavPrefs();
   const index = prefs.order.indexOf(id);
   const swapWith = index + direction;
   if (index < 0 || swapWith < 0 || swapWith >= prefs.order.length) {
      return prefs;
   }
   const other = catalog[prefs.order[swapWith]];
   if (other?.locked) {
      return prefs;
   }
   const order = [...prefs.order];
   [order[index], order[swapWith]] = [order[swapWith], order[index]];
   return setNavPrefs({ ...prefs, order });
}

export function toggleNavViewHidden(id) {
   const catalog = catalogById();
   if (!catalog[id] || catalog[id].locked) {
      return getNavPrefs();
   }
   const prefs = getNavPrefs();
   const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((value) => value !== id)
      : [...prefs.hidden, id];
   return setNavPrefs({ ...prefs, hidden });
}
