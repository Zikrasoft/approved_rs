import { z } from 'zod';
import { CATEGORY_FIELD_TYPES, attributeValuesSchema } from './attributes.ts';
import {
  CATALOG_TRANSLATION_LOCALES,
  type CategoryField,
  localizedUnit,
  translated,
} from './categories.ts';
import { brandNumberSchema, demandField } from './partPages.ts';
import { partOfferSchema } from './cart-wire.ts';
import { carHitSchema, vehicleSchema } from './vehicle.ts';

export const CATALOG_LOCALES = ['ru', ...CATALOG_TRANSLATION_LOCALES] as const;

export type CatalogLocale = (typeof CATALOG_LOCALES)[number];

export const searchResultSchema = brandNumberSchema.extend({
  part: z.object({
    id: z.string(),
    name: z.string(),
    category: z.object({ slug: z.string(), name: z.string() }).nullable(),
    attributes: attributeValuesSchema.nullable().default(null).catch(null),
  }),
  offers: z.array(partOfferSchema),
  thumbnail: z.url().nullable(),
  thumbnail_illustration: z.boolean().nullable().default(null),
  demand: demandField,
});

export const SEARCH_SORTS = ['popular'] as const;

export type SearchSort = (typeof SEARCH_SORTS)[number];

const readableCars = z
  .array(z.unknown())
  .default([])
  .transform((items) =>
    items.flatMap((item) => {
      const car = carHitSchema.safeParse(item);
      return car.success ? [car.data] : [];
    }),
  );

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
  model: vehicleSchema.shape.model.nullable().default(null),
  cars: readableCars,
  scope_pages: z
    .object({ model: z.boolean(), make: z.boolean() })
    .nullable()
    .default(null)
    .catch(null),
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
    unit: localizedUnit(field.unit, locale),
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
        (type === 'number'
          ? values.length > 1
          : values.some(({ count }) => count < total))),
  );

const NUMBER = '-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';

export const RANGE_BOUND_LIMIT = 1e9;

const RANGE_BOUND_DECIMALS = 6;

const rangeBound = (value: number): number =>
  Number(
    Math.min(Math.max(value, -RANGE_BOUND_LIMIT), RANGE_BOUND_LIMIT).toFixed(
      RANGE_BOUND_DECIMALS,
    ),
  ) || 0;

export const RANGE_FILTER_PATTERN = new RegExp(
  `^([a-z0-9-]+):(${NUMBER})?:(${NUMBER})?$`,
);

export type RangeFilter = {
  key: string;
  min: number | null;
  max: number | null;
};

const writtenBound = (value: number | null) =>
  value === null ? '' : String(rangeBound(value));

export const rangeFilter = ({ key, min, max }: RangeFilter): string =>
  `${key}:${writtenBound(min)}:${writtenBound(max)}`;

export const parseRangeFilter = (filter: string): RangeFilter | null => {
  const match = RANGE_FILTER_PATTERN.exec(filter);
  if (!match || (match[2] === undefined && match[3] === undefined)) {
    return null;
  }
  const bound = (text: string | undefined) =>
    text === undefined ? null : rangeBound(Number(text));
  const [min, max] = [bound(match[2]), bound(match[3])];
  return min !== null && max !== null && min > max
    ? { key: match[1], min: max, max: min }
    : { key: match[1], min, max };
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

export const FACET_FILTER_PATTERN = /^[a-z0-9-]+:[^`]+$/;

export const SEARCH_FILTER_CAPS = { keys: 8, facetValues: 20, ranges: 10 };

export const MAX_OFFER_IDS = 100;

export const MAX_PAGE = 1000;

const facetKey = (facet: string): string => facet.slice(0, facet.indexOf(':'));

export const filteredKeyCount = (
  facets: string[],
  ranges: RangeFilter[],
): number =>
  new Set([...facets.map(facetKey), ...ranges.map(({ key }) => key)]).size;

export const filtersWithinCap = (
  facets: string[],
  ranges: RangeFilter[],
): { facets: string[]; ranges: RangeFilter[] } => {
  const keys = new Set<string>();
  const fits = (key: string) => {
    if (!keys.has(key) && keys.size >= SEARCH_FILTER_CAPS.keys) return false;
    keys.add(key);
    return true;
  };
  return {
    facets: [...new Set(facets)]
      .filter((facet) => FACET_FILTER_PATTERN.test(facet))
      .slice(0, SEARCH_FILTER_CAPS.facetValues)
      .filter((facet) => fits(facetKey(facet))),
    ranges: ranges
      .slice(0, SEARCH_FILTER_CAPS.ranges)
      .filter(({ key }) => fits(key)),
  };
};

export const searchableQuery = (q: string): boolean => /[\p{L}\p{N}]/u.test(q);

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchFacet = z.infer<typeof searchFacetSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
