import { z } from 'zod';
import {
  CATALOG_TRANSLATION_LOCALES,
  type CategoryField,
  translated,
} from './categories.ts';
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
  category: z.object({ slug: z.string(), name: z.string() }).nullable(),
  count: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export const facetFilter = (key: string, value: string): string =>
  `${key}:${value}`;

export const describeFacet = (
  field: CategoryField,
  values: { value: string; count: number }[],
  locale: string,
): SearchFacet => {
  const option = (value: string) =>
    field.options.find(({ key }) => key === value);
  const rank = (value: string) => option(value)?.rank ?? 0;
  return {
    key: field.key,
    label: translated(field, 'label', locale),
    unit: field.unit,
    values: values
      .slice()
      .sort(
        (a, b) =>
          rank(a.value) - rank(b.value) ||
          a.value.localeCompare(b.value, 'en', { numeric: true }),
      )
      .map(({ value, count }) => {
        const known = option(value);
        return {
          value,
          label: known ? translated(known, 'label', locale) : value,
          count,
        };
      }),
  };
};

export const searchableQuery = (q: string): boolean => /[\p{L}\p{N}]/u.test(q);

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchFacet = z.infer<typeof searchFacetSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
