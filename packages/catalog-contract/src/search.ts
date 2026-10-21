import { z } from 'zod';
import { CATALOG_TRANSLATION_LOCALES } from './categories.ts';
import { brandNumberSchema, partOfferSchema } from './partPages.ts';

export const CATALOG_LOCALES = ['ru', ...CATALOG_TRANSLATION_LOCALES] as const;

export type CatalogLocale = (typeof CATALOG_LOCALES)[number];

export const searchResultSchema = brandNumberSchema.extend({
  part: z.object({
    id: z.string(),
    name: z.string(),
    category: z.object({ slug: z.string(), name: z.string() }).nullable(),
  }),
  offers: z.array(partOfferSchema),
});

export const searchFacetSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string().nullable(),
  values: z.array(
    z.object({ value: z.string(), label: z.string(), count: z.number() }),
  ),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  facets: z.array(searchFacetSchema),
  count: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export const facetFilter = (key: string, value: string): string =>
  `${key}:${value}`;

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchFacet = z.infer<typeof searchFacetSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
