export const prerender = false;

import type { APIRoute } from 'astro';
import { CATALOG_KEY_PATTERN, searchableQuery } from '@podbor/catalog-contract';
import { z } from 'zod';
import { localeFieldSchema } from '@/i18n/localeField';
import { searchReporter } from '@/lib/shopEvents';
import { catalogueFor } from '@/utils/catalogueEnv';
import { partsQuery, rangesFromParams } from '@/utils/partsSearch';

const catalogKey = z.string().regex(CATALOG_KEY_PATTERN).optional();

const querySchema = z.object({
  q: z.string().transform(partsQuery).catch(''),
  category: catalogKey,
  make: catalogKey,
  model: catalogKey,
  locale: localeFieldSchema,
});

export const GET: APIRoute = async ({ url, request }) => {
  const params = url.searchParams;
  const parsed = querySchema.safeParse({
    q: params.get('q') ?? '',
    category: params.get('category') ?? undefined,
    make: params.get('make') ?? undefined,
    model: params.get('model') ?? undefined,
    locale: params.get('locale'),
  });
  const report = searchReporter(request, 'count');
  const intent =
    parsed.success && searchableQuery(parsed.data.q) ? 'query' : 'empty';
  const scoped =
    parsed.success &&
    (searchableQuery(parsed.data.q) ||
      parsed.data.category ||
      parsed.data.model);
  const catalogue = scoped ? catalogueFor(request) : null;
  if (!parsed.success || !catalogue) {
    report(intent, 'skipped');
    return Response.json({ count: null });
  }
  const { q, category, make, model, locale } = parsed.data;
  const found = await catalogue.search({
    q,
    category,
    make,
    model,
    locale,
    facets: params.getAll('facets'),
    ranges: rangesFromParams(params),
    limit: 1,
  });
  if (!found) {
    report(intent, 'unavailable');
    return Response.json({ count: null }, { status: 503 });
  }
  report(intent, 'ok', found.count);
  return Response.json({
    count: found.count,
    facets: Object.fromEntries(
      found.facets.map(({ key, values }) => [
        key,
        Object.fromEntries(values.map(({ value, count }) => [value, count])),
      ]),
    ),
  });
};
