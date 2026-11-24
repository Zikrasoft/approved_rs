import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { APPROVED } from '@podbor/brands';
import { BCP47_BY_LOCALE, localeConfig } from './src/i18n/config.ts';

export default defineConfig({
  site: APPROVED.url,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    allowedDomains: [{ hostname: APPROVED.domain, protocol: 'https' }],
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
      i18n: {
        defaultLocale: localeConfig.primaryLocale,
        locales: BCP47_BY_LOCALE,
      },
      filter: (page) => !page.includes('/admin/case-photos'),
    }),
  ],
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'bundle-server-dependencies',
        apply: 'build',
        config: () => ({ ssr: { noExternal: true } }),
      },
    ],
  },
});
