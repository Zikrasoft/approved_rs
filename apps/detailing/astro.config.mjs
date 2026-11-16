import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { DETAILS } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';

const site = DETAILS.url;

export default defineConfig({
  site,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    allowedDomains: [{ hostname: DETAILS.domain, protocol: 'https' }],
  },
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
      filter: (page) =>
        page !== `${site}/` && !['/thanks/'].some((s) => page.includes(s)),
      i18n: {
        defaultLocale: localeConfig.primaryLocale,
        locales: Object.fromEntries(localeConfig.locales.map((l) => [l, l])),
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    ssr: { noExternal: true },
  },
});
