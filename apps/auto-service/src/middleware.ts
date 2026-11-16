import { defineMiddleware } from 'astro:middleware';
import { createLocaleMiddleware } from '@podbor/site-kit/locale-middleware';
import { detectLocale, isLocale } from './i18n/config';

export const onRequest = defineMiddleware(
  createLocaleMiddleware({
    isLocale,
    detectLocale,
    unlocalized: {
      exact: [
        '/robots.txt',
        '/llms.txt',
        '/catalogue-build.json',
        '/404',
        '/404/',
      ],
      prefixes: ['/api/', '/admin/', '/keystatic', '/_image', '/.well-known/'],
    },
  }),
);
