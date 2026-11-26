import type { APIRoute } from 'astro';
import { z } from 'zod';
import { answerCatalogueFile } from '@/utils/cataloguePage';
import { catalogueSitemaps, urlsetXml } from '@/utils/sitemap';

export const prerender = false;

const chunkSchema = z.coerce.number().int().nonnegative();

export const GET: APIRoute = (context) =>
  answerCatalogueFile(
    context,
    'application/xml; charset=utf-8',
    async (catalogue) => {
      const chunks = await catalogueSitemaps(catalogue);
      const chunk = chunkSchema.safeParse(context.params.chunk);
      const urls = chunk.success ? chunks[chunk.data] : undefined;
      return urls ? urlsetXml(urls) : null;
    },
  );
