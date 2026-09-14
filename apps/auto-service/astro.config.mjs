import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { CARLAB } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';
import { SHOP_ENABLED } from './src/utils/constants.ts';

const site = CARLAB.url;
const sitemapExcludes = SHOP_ENABLED
  ? ['/thanks/', '/cart/']
  : ['/thanks/', '/cart/', '/shop/'];

export default defineConfig({
  site,
  output: 'static',
  adapter: vercel(),
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
        page !== `${site}/` && !sitemapExcludes.some((s) => page.includes(s)),
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
