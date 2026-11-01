export const prerender = false;

import type { APIRoute } from 'astro';
import { searchableQuery } from '@podbor/catalog-contract';
import { z } from 'zod';
import { localeFieldSchema } from '@/i18n/localeField';
import { content } from '@/i18n/content';
import { catalogueFor } from '@/utils/catalogueEnv';
import { searchIntent, suggestionsFrom } from '@/utils/catalogueSearch';
import { searchEitherLayout } from '@/utils/keyboardLayout';
import { partsQuery } from '@/utils/partsSearch';

const SUGGESTION_LIMIT = 5;

const querySchema = z.object({
  q: z.string().transform(partsQuery).catch(''),
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
  const catalogue = searchableQuery(q) ? catalogueFor(request) : null;
  if (!catalogue) {
    return Response.json(NOTHING);
  }
  const { found } = await searchEitherLayout(q, (query) =>
    catalogue.search({
      q: query,
      locale,
      facets: [],
      limit: SUGGESTION_LIMIT,
    }),
  );
  return found
    ? Response.json({
        vin: false,
        ...suggestionsFrom(
          found,
          locale,
          content(locale).partsSearch.allModifications,
        ),
      })
    : Response.json(NOTHING, { status: 503 });
};
