import type { APIRoute } from 'astro';
import { answerCatalogueFile } from '@/utils/cataloguePage';

export const prerender = false;

export const GET: APIRoute = (context) =>
  answerCatalogueFile(context, 'application/json', async (catalogue) =>
    JSON.stringify({ partPages: (await catalogue.pageList()).parts.length }),
  );
