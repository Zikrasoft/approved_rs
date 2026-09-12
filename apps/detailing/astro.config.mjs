import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { localeConfig } from './src/i18n/config.ts';

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
        locales: Object.fromEntries(localeConfig.locales.map((l) => [l, l])),
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
