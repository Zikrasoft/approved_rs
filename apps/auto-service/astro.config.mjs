import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { CARLAB } from '@podbor/brands';
import { localeConfig } from './src/i18n/config.ts';
import { blogListed } from '@podbor/blog/article';
import { carsUrls, catalogueUrls, sitemapFilter } from './src/utils/sitemap.ts';
import {
  pageListForBuild,
  writeCatalogueMakes,
} from './src/utils/catalogueEnv.ts';
import { partsHubPlugin } from './src/utils/partsHub.ts';

const site = CARLAB.url;
const pageList = await pageListForBuild(process.env);
await writeCatalogueMakes(
  new URL('./src/content/makes.json', import.meta.url),
  process.env,
);
const { articleFiles } = await import('./src/utils/articleFiles.ts');
const articles = await articleFiles(
  fileURLToPath(new URL('./src/content/articles/', import.meta.url)),
);
const blog = blogListed(articles);
const { workFiles } = await import('./src/utils/workFiles.ts');
const { workshopMakePages } = await import('./src/utils/works.ts');
const workshopMakes = workshopMakePages(
  await workFiles(
    fileURLToPath(new URL('./src/content/works/', import.meta.url)),
  ),
  articles,
  [],
).map(({ make }) => make.slug);

export default defineConfig({
  site,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    allowedDomains: [{ hostname: CARLAB.domain, protocol: 'https' }],
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
      filter: sitemapFilter(site, pageList.parts, blog),
      customPages: [
        ...catalogueUrls(site, pageList),
        ...carsUrls(site, workshopMakes),
      ],
      i18n: {
        defaultLocale: localeConfig.primaryLocale,
        locales: Object.fromEntries(localeConfig.locales.map((l) => [l, l])),
      },
    }),
  ],
  vite: {
    plugins: [
      tailwindcss(),
      partsHubPlugin(process.env),
      {
        name: 'bundle-server-dependencies',
        apply: 'build',
        config: () => ({ ssr: { noExternal: true } }),
      },
    ],
  },
  experimental: {
    incrementalBuild: true,
  },
});
