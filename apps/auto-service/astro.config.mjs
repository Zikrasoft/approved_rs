import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { CARLAB } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';
import { blogListed } from '@podbor/blog/article';
import { sitemapFilter } from './src/utils/sitemap.ts';
import { articleFiles } from './src/utils/articleFiles.ts';
import { partPagesForBuild } from './src/utils/catalogueEnv.ts';

const site = CARLAB.url;
const partPages = await partPagesForBuild(process.env);
const blog = blogListed(
  await articleFiles(
    fileURLToPath(new URL('./src/content/articles/', import.meta.url)),
  ),
);

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
      filter: sitemapFilter(site, partPages, blog),
      i18n: {
        defaultLocale: localeConfig.primaryLocale,
        locales: Object.fromEntries(localeConfig.locales.map((l) => [l, l])),
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  experimental: {
    incrementalBuild: true,
  },
});
