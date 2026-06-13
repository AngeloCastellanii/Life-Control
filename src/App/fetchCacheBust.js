import { STYLE_VERSION } from './styleVersion.js';

const STYLE_PATH = /\/Styles\/[^/?]+\.css(\?.*)?$/i;
const THEME_PATH = /\/Themes\/[^/?]+\.css(\?.*)?$/i;
const BUNDLE_PATH = /\/bundles\/[^/?]+\.js(\?.*)?$/i;

export function getStyleCacheKey() {
   return localStorage.getItem('lc_style_v') || STYLE_VERSION;
}

/** Safari iOS cachea fetch() de CSS; Slice carga estilos así, no con link tags. */
export function installFetchCacheBust() {
   if (window.__lcFetchCacheBust) {
      return;
   }

   const nativeFetch = window.fetch.bind(window);

   window.fetch = (input, init = {}) => {
      const rawUrl = typeof input === 'string' ? input : input?.url ?? '';
      let url = rawUrl;
      let options = { ...init };

      if (STYLE_PATH.test(rawUrl) || THEME_PATH.test(rawUrl)) {
         const parsed = new URL(rawUrl, window.location.origin);
         parsed.searchParams.set('v', getStyleCacheKey());
         url = parsed.toString();
         options.cache = 'no-store';
         return nativeFetch(url, options);
      }

      if (BUNDLE_PATH.test(rawUrl)) {
         options.cache = 'no-store';
      }

      return nativeFetch(input, options);
   };

   window.__lcFetchCacheBust = true;
}
