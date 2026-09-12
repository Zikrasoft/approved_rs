import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { BCP47_BY_LOCALE, localeConfig } from './src/i18n/config.ts';

export default defineConfig({
  site: 'https://prizma.rs',
  output: 'static',
  adapter: vercel(),
  i18n: {
    locales: [...localeConfig.locales],
    defaultLocale: localeConfig.defaultLocale,
    routing: 'manual',
  },
  integrations: [
    react(),
    keystatic(),
    sitemap({
      filter: (page) =>
        page !== 'https://prizma.rs/' &&
        !['/thanks/'].some((s) => page.includes(s)),
      i18n: {
        defaultLocale: localeConfig.defaultLocale,
        locales: BCP47_BY_LOCALE,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
