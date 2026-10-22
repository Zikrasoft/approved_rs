import { z } from 'zod';
import { CATEGORY_FIELD_TYPES } from './attributes.ts';
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
  type: z.enum(CATEGORY_FIELD_TYPES),
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
    type: field.type,
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

export const BRAND_FACET = 'brand';
export const IN_STOCK_FACET = 'in-stock';
export const PRICE_FACET = 'price';
export const IN_STOCK = 'true';

export const UNIVERSAL_FACET_KEYS = [
  BRAND_FACET,
  IN_STOCK_FACET,
  PRICE_FACET,
] as const;

type FacetValue = SearchFacet['values'][number];

export const universalFacets = ({
  brands,
  inStock,
  price,
  currency,
}: {
  brands: FacetValue[];
  inStock: number;
  price: { min: number; max: number; count: number } | null;
  currency: string;
}): SearchFacet[] => {
  const bounds = price
    ? [...new Set([price.min, price.max])].map((value) => ({
        value: String(value),
        label: String(value),
        count: price.count,
      }))
    : [];
  return [
    {
      key: BRAND_FACET,
      type: 'single-select',
      label: BRAND_FACET,
      unit: null,
      values: brands
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, 'en')),
    },
    {
      key: IN_STOCK_FACET,
      type: 'boolean',
      label: IN_STOCK_FACET,
      unit: null,
      values: [{ value: IN_STOCK, label: IN_STOCK, count: inStock }],
    },
    {
      key: PRICE_FACET,
      type: 'number',
      label: PRICE_FACET,
      unit: currency,
      values: bounds,
    },
  ];
};

export const usefulFacets = (
  facets: SearchFacet[],
  total: number,
  chosenKeys: string[],
): SearchFacet[] =>
  facets.filter(
    ({ key, type, values }) =>
      chosenKeys.includes(key) ||
      (values.some(({ count }) => count > 0) &&
        !(
          values.length === 1 &&
          (type === 'number' || values[0].count >= total)
        )),
  );

const NUMBER = '-?\\d+(?:\\.\\d+)?';

export const RANGE_FILTER_PATTERN = new RegExp(
  `^([a-z0-9-]+):(${NUMBER})?:(${NUMBER})?$`,
);

export type RangeFilter = {
  key: string;
  min: number | null;
  max: number | null;
};

export const rangeFilter = ({ key, min, max }: RangeFilter): string =>
  `${key}:${min ?? ''}:${max ?? ''}`;

export const parseRangeFilter = (filter: string): RangeFilter | null => {
  const match = RANGE_FILTER_PATTERN.exec(filter);
  if (!match || (match[2] === undefined && match[3] === undefined)) {
    return null;
  }
  const bound = (text: string | undefined) =>
    text === undefined ? null : Number(text);
  return { key: match[1], min: bound(match[2]), max: bound(match[3]) };
};

export const inRange = (value: string, { min, max }: RangeFilter): boolean => {
  const number = Number(value);
  return (
    value.trim() !== '' &&
    Number.isFinite(number) &&
    (min === null || number >= min) &&
    (max === null || number <= max)
  );
};

export const searchableQuery = (q: string): boolean => /[\p{L}\p{N}]/u.test(q);

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchFacet = z.infer<typeof searchFacetSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
