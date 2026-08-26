const HIDE_PAST_BLOCKS_KEY = 'lc_hide_past_blocks';
const DASHBOARD_TASK_FILTER_KEY = 'lc_dashboard_task_filter';

export const DASHBOARD_TASK_FILTERS = {
   ALL: 'all',
   DUE: 'due',
   URGENT: 'urgent',
   BLOCKS: 'blocks',
   DOMAIN: 'domain'
};

function readFlag(key, fallback = false) {
   try {
      const stored = localStorage.getItem(key);
      if (stored == null) {
         return fallback;
      }
      return stored === '1' || stored === 'true';
   } catch {
      return fallback;
   }
}

function writeFlag(key, value) {
   try {
      localStorage.setItem(key, value ? '1' : '0');
   } catch {
      /* ignore */
   }
}

export function getHidePastBlocks() {
   return readFlag(HIDE_PAST_BLOCKS_KEY, false);
}

export function setHidePastBlocks(enabled) {
   writeFlag(HIDE_PAST_BLOCKS_KEY, Boolean(enabled));
   return Boolean(enabled);
}

export function getDashboardTaskFilter() {
   try {
      const stored = localStorage.getItem(DASHBOARD_TASK_FILTER_KEY);
      if (Object.values(DASHBOARD_TASK_FILTERS).includes(stored)) {
         return stored;
      }
   } catch {
      /* ignore */
   }
   return DASHBOARD_TASK_FILTERS.ALL;
}

export function setDashboardTaskFilter(filter) {
   const next = Object.values(DASHBOARD_TASK_FILTERS).includes(filter)
      ? filter
      : DASHBOARD_TASK_FILTERS.ALL;
   try {
      localStorage.setItem(DASHBOARD_TASK_FILTER_KEY, next);
   } catch {
      /* ignore */
   }
   return next;
}
