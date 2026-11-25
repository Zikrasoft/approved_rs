import type { APIRoute } from 'astro';
import { CARLAB } from '@podbor/brands';
import { answerCatalogueFile } from '@/utils/cataloguePage';
import {
  catalogueSitemapChunks,
  catalogueSitemapPath,
  catalogueUrls,
  sitemapIndexXml,
} from '@/utils/sitemap';

export const prerender = false;

export const GET: APIRoute = (context) =>
  answerCatalogueFile(
    context,
    'application/xml; charset=utf-8',
    async (catalogue) =>
      sitemapIndexXml(
        catalogueSitemapChunks(
          catalogueUrls(CARLAB.url, await catalogue.pageList()),
        ).map((_, chunk) => `${CARLAB.url}${catalogueSitemapPath(chunk)}`),
      ),
  );
