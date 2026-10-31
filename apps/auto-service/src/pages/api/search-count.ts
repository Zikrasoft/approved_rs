export const prerender = false;

import type { APIRoute } from 'astro';
import { CATALOG_KEY_PATTERN, searchableQuery } from '@podbor/catalog-contract';
import { z } from 'zod';
import { localeFieldSchema } from '@/i18n/localeField';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogueEnv';
import { partsQuery, rangesFromParams } from '@/utils/partsSearch';
import { previewRequested } from '@/utils/shopPreview';

const catalogKey = z.string().regex(CATALOG_KEY_PATTERN).optional();

const querySchema = z.object({
  q: z.string().transform(partsQuery).catch(''),
  category: catalogKey,
  model: catalogKey,
  locale: localeFieldSchema,
});

export const GET: APIRoute = async ({ url, request }) => {
  const params = url.searchParams;
  const parsed = querySchema.safeParse({
    q: params.get('q') ?? '',
    category: params.get('category') ?? undefined,
    model: params.get('model') ?? undefined,
    locale: params.get('locale'),
  });
  const scoped =
    parsed.success &&
    (searchableQuery(parsed.data.q) ||
      parsed.data.category ||
      parsed.data.model);
  const catalogue = scoped
    ? catalogueFromEnv(siteEnv(), { preview: previewRequested(request) })
    : null;
  if (!parsed.success || !catalogue) {
    return Response.json({ count: null });
  }
  const { q, category, model, locale } = parsed.data;
  const found = await catalogue.search({
    q,
    category,
    model,
    locale,
    facets: params.getAll('facets'),
    ranges: rangesFromParams(params),
    limit: 1,
  });
  return found
    ? Response.json({ count: found.count })
    : Response.json({ count: null }, { status: 503 });
};
