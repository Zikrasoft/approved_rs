import { defineMiddleware } from 'astro:middleware';
import { createLocaleMiddleware } from '@podbor/site-kit/locale-middleware';
import { detectLocale, isLocale } from './i18n/config';
import { REDIRECTS } from './redirects';

export const onRequest = defineMiddleware(
  createLocaleMiddleware({
    isLocale,
    detectLocale,
    redirects: REDIRECTS,
    unlocalized: {
      exact: ['/llms.txt', '/404', '/404/'],
      prefixes: [
        '/api/',
        '/keystatic',
        '/_image',
        '/.well-known/',
        '/admin/case-photos',
      ],
    },
  }),
);
