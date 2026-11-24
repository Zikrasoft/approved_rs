import { defineMiddleware } from 'astro:middleware';
import { createLocaleMiddleware } from '@podbor/site-kit/locale-middleware';
import { localeSet } from './i18n/config';
import { REDIRECTS } from './redirects';

export const onRequest = defineMiddleware(
  createLocaleMiddleware({
    locales: localeSet,
    redirects: REDIRECTS,
    unlocalized: { prefixes: ['/admin/case-photos'] },
  }),
);
