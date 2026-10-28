import type { Plugin } from 'vite' with { 'resolution-mode': 'import' };

export const ADMIN_LANGUAGE = 'ru';
export const ADMIN_LANGUAGE_MARK = 'carlab-admin-language';

export const adminLanguageScript = `(() => {
  try {
    if (localStorage.getItem('${ADMIN_LANGUAGE_MARK}')) return;
    localStorage.setItem('lng', '${ADMIN_LANGUAGE}');
    localStorage.setItem('${ADMIN_LANGUAGE_MARK}', '${ADMIN_LANGUAGE}');
    document.cookie = 'lng=${ADMIN_LANGUAGE};path=/;max-age=31536000;samesite=strict';
  } catch {}
})();`;

export const adminLanguage = (): Plugin => ({
  name: 'carlab-admin-language',
  transformIndexHtml: () => [
    { tag: 'script', injectTo: 'head-prepend', children: adminLanguageScript },
  ],
});
