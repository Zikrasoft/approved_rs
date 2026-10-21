import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { CARLAB } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';
import { sitemapFilter } from './src/utils/sitemap.ts';
import { partPagesForBuild } from './src/utils/catalogue.ts';

const site = CARLAB.url;
const localEnvFile = new URL('./.env.local', import.meta.url);
const localEnv = existsSync(localEnvFile)
  ? parseEnv(readFileSync(localEnvFile, 'utf8'))
  : {};
const partPages = await partPagesForBuild({
  MEDUSA_BACKEND_URL:
    process.env.MEDUSA_BACKEND_URL ?? localEnv.MEDUSA_BACKEND_URL,
  MEDUSA_PUBLISHABLE_KEY:
    process.env.MEDUSA_PUBLISHABLE_KEY ?? localEnv.MEDUSA_PUBLISHABLE_KEY,
});

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
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
