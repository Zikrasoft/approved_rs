export const prerender = false;

import type { APIRoute } from 'astro';
import { searchableQuery } from '@podbor/catalog-contract';
import { z } from 'zod';
import { localeFieldSchema } from '@/i18n/localeField';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogueEnv';
import { searchIntent, suggestionsFrom } from '@/utils/catalogueSearch';
import { PARTS_QUERY_MAX_LENGTH } from '@/utils/partsSearch';
import { previewRequested } from '@/utils/shopPreview';

const SUGGESTION_LIMIT = 5;

const querySchema = z.object({
  q: z.string().trim().max(PARTS_QUERY_MAX_LENGTH).catch(''),
  locale: localeFieldSchema,
});

const NOTHING = { vin: false, cars: [], parts: [] };

export const GET: APIRoute = async ({ url, request }) => {
  const { q, locale } = querySchema.parse({
    q: url.searchParams.get('q') ?? '',
    locale: url.searchParams.get('locale'),
  });
  if (searchIntent(q).kind === 'vin') {
    return Response.json({ ...NOTHING, vin: true });
  }
  const found = searchableQuery(q)
    ? await catalogueFromEnv(siteEnv(), {
        preview: previewRequested(request),
      })?.search({ q, locale, facets: [], limit: SUGGESTION_LIMIT })
    : null;
  return Response.json(
    found ? { vin: false, ...suggestionsFrom(found, locale) } : NOTHING,
  );
};
