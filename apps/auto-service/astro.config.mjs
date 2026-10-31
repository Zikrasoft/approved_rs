import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { CARLAB } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';
import { sitemapFilter } from './src/utils/sitemap.ts';
import {
  cataloguePagesForBuild,
  partPagesForBuild,
  redirectsForBuild,
  vehiclesForBuild,
} from './src/utils/catalogueEnv.ts';
import {
  carRoutes,
  catalogueRedirectsIntegration,
  catalogueRoutes,
} from './src/utils/catalogueRedirects.ts';

const site = CARLAB.url;
const partPages = await partPagesForBuild(process.env);
const pages = await cataloguePagesForBuild(process.env);
const redirects = [
  ...catalogueRoutes(await redirectsForBuild(process.env), pages),
  ...carRoutes(await vehiclesForBuild(process.env), pages),
];

export default defineConfig({
  site,
  output: 'static',
  adapter: vercel(),
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  i18n: {
    locales: [...localeConfig.locales],
    defaultLocale: localeConfig.primaryLocale,
    routing: 'manual',
  },
  integrations: [
    react(),
    keystatic(),
    sitemap({
      filter: sitemapFilter(site, partPages),
      i18n: {
        defaultLocale: localeConfig.primaryLocale,
        locales: Object.fromEntries(localeConfig.locales.map((l) => [l, l])),
      },
    }),
    catalogueRedirectsIntegration(redirects),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  experimental: {
    incrementalBuild: true,
  },
});
