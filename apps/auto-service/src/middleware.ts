import { defineMiddleware } from 'astro:middleware';
import { createLocaleMiddleware } from '@podbor/site-kit/locale-middleware';
import { localeSet } from './i18n/config';

export const onRequest = defineMiddleware(
  createLocaleMiddleware({
    locales: localeSet,
    unlocalized: { prefixes: ['/admin/'] },
  }),
);
