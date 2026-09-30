import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { CARLAB } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';
import { SHOP_STATUS } from './src/utils/shopStatus.ts';
import { sitemapFilter } from './src/utils/sitemap.ts';

const site = CARLAB.url;

const medusaUrl = process.env.PUBLIC_MEDUSA_BACKEND_URL;
const medusaHost = medusaUrl ? new URL(medusaUrl) : undefined;

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
  image: {
    remotePatterns: medusaHost
      ? [
          {
            protocol: medusaHost.protocol.replace(':', ''),
            hostname: medusaHost.hostname,
            ...(medusaHost.port && { port: medusaHost.port }),
            pathname: '/static/**',
          },
        ]
      : [],
  },
  integrations: [
    react(),
    keystatic(),
    sitemap({
      filter: sitemapFilter(site, SHOP_STATUS),
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
