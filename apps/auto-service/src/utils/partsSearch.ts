import {
  BRAND_FACET,
  IN_STOCK_FACET,
  PRICE_FACET,
  type RangeFilter,
  type SearchFacet,
} from '@podbor/catalog-contract';
import { singleLine } from '@podbor/lead-crm/phone';

export const PARTS_QUERY_MAX_LENGTH = 100;
export const RANGE_LIMIT = 1_000_000_000;
const RANGE_DECIMALS = 1_000_000;

export const partsQuery = (raw: string): string =>
  singleLine(raw).slice(0, PARTS_QUERY_MAX_LENGTH);

const RANGE_MIN = 'min.';
const RANGE_MAX = 'max.';
const FIELD_KEY = /^[a-z0-9-]+$/;

type FacetCopy = { booleanTrue: string; booleanFalse: string };
type RangeCopy = { rangeFrom: string; rangeTo: string; rangeBetween: string };

export const facetValueLabel = (
  facet: Pick<SearchFacet, 'unit'>,
  { value, label }: { value: string; label: string },
  copy: FacetCopy,
): string => {
  if (label !== value) return label;
  if (value === 'true') return copy.booleanTrue;
  if (value === 'false') return copy.booleanFalse;
  return facet.unit ? `${value} ${facet.unit}` : value;
};

type UniversalCopy = {
  brandFacet: string;
  availabilityFacet: string;
  inStockOnly: string;
  priceFacet: string;
};

export const withFacetCopy = (
  facets: SearchFacet[],
  copy: UniversalCopy,
): SearchFacet[] =>
  facets.map((facet) => {
    switch (facet.key) {
      case BRAND_FACET:
        return { ...facet, label: copy.brandFacet };
      case IN_STOCK_FACET:
        return {
          ...facet,
          label: copy.availabilityFacet,
          values: facet.values.map((value) => ({
            ...value,
            label: copy.inStockOnly,
          })),
        };
      case PRICE_FACET:
        return { ...facet, label: copy.priceFacet };
      default:
        return facet;
    }
  });

export const rangeMinName = (key: string): string => `${RANGE_MIN}${key}`;
export const rangeMaxName = (key: string): string => `${RANGE_MAX}${key}`;

const bound = (text: string | null): number | null => {
  const trimmed = text?.trim() ?? '';
  const number = Number(trimmed.replace(',', '.'));
  return trimmed && !Number.isNaN(number) && number >= 0
    ? Math.round(Math.min(number, RANGE_LIMIT) * RANGE_DECIMALS) /
        RANGE_DECIMALS
    : null;
};

export const rangesFromParams = (params: URLSearchParams): RangeFilter[] => {
  const keys = new Set(
    [...params.keys()]
      .filter(
        (name) => name.startsWith(RANGE_MIN) || name.startsWith(RANGE_MAX),
      )
      .map((name) => name.slice(RANGE_MIN.length))
      .filter((key) => FIELD_KEY.test(key)),
  );
  return [...keys].flatMap((key) => {
    const low = bound(params.get(rangeMinName(key)));
    const high = bound(params.get(rangeMaxName(key)));
    if (low === null && high === null) return [];
    const [min, max] =
      low !== null && high !== null && low > high ? [high, low] : [low, high];
    return [{ key, min, max }];
  });
};

export const appendRange = (
  params: URLSearchParams,
  { key, min, max }: RangeFilter,
): void => {
  if (min !== null) params.append(rangeMinName(key), String(min));
  if (max !== null) params.append(rangeMaxName(key), String(max));
};

export const numberBounds = (
  facet: SearchFacet,
): { min: number; max: number } | null => {
  const numbers = facet.values
    .map(({ value }) => Number(value))
    .filter(Number.isFinite);
  return numbers.length
    ? { min: Math.min(...numbers), max: Math.max(...numbers) }
    : null;
};

export const rangeText = (
  { min, max }: Pick<RangeFilter, 'min' | 'max'>,
  unit: string | null,
  copy: RangeCopy,
  format: (value: number) => string = String,
): string => {
  const text =
    min !== null && max !== null
      ? min === max
        ? format(min)
        : copy.rangeBetween
            .replace('{min}', format(min))
            .replace('{max}', format(max))
      : min !== null
        ? copy.rangeFrom.replace('{min}', format(min))
        : copy.rangeTo.replace('{max}', max === null ? '' : format(max));
  return unit ? `${text} ${unit}` : text;
};

export type FilterChip = {
  facets: string[];
  ranges: RangeFilter[];
  label: string;
};

export const chosenFilters = (
  facets: SearchFacet[],
  chosen: string[],
  ranges: RangeFilter[],
  copy: FacetCopy & RangeCopy,
  format: (value: number) => string = String,
): FilterChip[] => {
  const facetOf = (key: string) => facets.find((facet) => facet.key === key);
  return [
    ...chosen.flatMap((filter) => {
      const split = filter.indexOf(':');
      const facet = facetOf(filter.slice(0, split));
      if (!facet) return [];
      const raw = filter.slice(split + 1);
      const value = facet.values.find((candidate) => candidate.value === raw);
      return [
        {
          facets: chosen.filter((item) => item !== filter),
          ranges,
          label: `${facet.label}: ${
            value ? facetValueLabel(facet, value, copy) : raw
          }`,
        },
      ];
    }),
    ...ranges.flatMap((range) => {
      const facet = facetOf(range.key);
      return facet
        ? [
            {
              facets: chosen,
              ranges: ranges.filter((item) => item !== range),
              label: `${facet.label}: ${rangeText(range, facet.unit, copy, format)}`,
            },
          ]
        : [];
    }),
  ];
};
