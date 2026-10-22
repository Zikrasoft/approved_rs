import { describe, expect, it } from 'vitest';
import {
  CATALOG_LOCALES,
  describeFacet,
  facetFilter,
  searchableQuery,
  searchResponseSchema,
} from './search.ts';

const response = {
  results: [
    {
      id: 'pi_1',
      type: 'oem',
      value: '11 42 8575211',
      normalized_value: '11428575211',
      superseded: false,
      brand: { name: 'BMW', slug: 'bmw' },
      part: {
        id: 'part_1',
        name: 'Filter ulja',
        category: { slug: 'oil-filters', name: 'Filteri ulja' },
      },
      offers: [
        {
          id: 'offer_1',
          price: 1850,
          currency: 'RSD',
          stock_quantity: 3,
          lead_time_days: 0,
        },
      ],
    },
  ],
  facets: [
    {
      key: 'viscosity',
      label: 'Viskozitet',
      unit: null,
      values: [{ value: '5w-30', label: '5W-30', count: 1 }],
    },
  ],
  category: null,
  count: 1,
  offset: 0,
  limit: 20,
};

describe('searchResponseSchema', () => {
  it('accepts a list of brand-numbers with their facets', () => {
    expect(searchResponseSchema.parse(response)).toEqual(response);
  });

  it('names the Category a listing was narrowed to', () => {
    const narrowed = {
      ...response,
      category: { slug: 'oil-filters', name: 'Filteri ulja' },
    };
    expect(searchResponseSchema.parse(narrowed)).toEqual(narrowed);
  });

  it('refuses a result without its Part', () => {
    const [result] = response.results;
    expect(() =>
      searchResponseSchema.parse({
        ...response,
        results: [{ ...result, part: undefined }],
      }),
    ).toThrow();
  });
});

describe('CATALOG_LOCALES', () => {
  it('lists Russian first, then the translated locales', () => {
    expect(CATALOG_LOCALES).toEqual(['ru', 'sr', 'en']);
  });
});

describe('facetFilter', () => {
  it('joins a field key and a value', () => {
    expect(facetFilter('viscosity', '5w-30')).toBe('viscosity:5w-30');
  });
});

describe('searchableQuery', () => {
  it.each(['HU 816 x', 'фильтр', '1142', 'HU%'])('searches %j', (q) => {
    expect(searchableQuery(q)).toBe(true);
  });

  it.each(['', ' ', '%', '*', '-/.'])('does not search %j', (q) => {
    expect(searchableQuery(q)).toBe(false);
  });
});

describe('describeFacet', () => {
  const field = {
    key: 'viscosity',
    type: 'single-select' as const,
    unit: null,
    label: 'Вязкость',
    translations: { sr: { label: 'Viskozitet' } },
    required: false,
    facet: true,
    rank: 1,
    options: [
      { key: '5w-30', label: '5W-30', translations: null, rank: 2 },
      { key: '0w-20', label: '0W-20', translations: null, rank: 1 },
    ],
  };

  it('labels the field and its options in the page locale, in option order', () => {
    expect(
      describeFacet(
        field,
        [
          { value: '5w-30', count: 2 },
          { value: '0w-20', count: 1 },
        ],
        'sr',
      ),
    ).toEqual({
      key: 'viscosity',
      label: 'Viskozitet',
      unit: null,
      values: [
        { value: '0w-20', label: '0W-20', count: 1 },
        { value: '5w-30', label: '5W-30', count: 2 },
      ],
    });
  });

  it('orders free values as numbers and keeps them as their own label', () => {
    const capacity = {
      ...field,
      key: 'capacity',
      type: 'number' as const,
      unit: 'Ah',
      options: [],
    };

    expect(
      describeFacet(
        capacity,
        [
          { value: '100', count: 1 },
          { value: '60', count: 3 },
          { value: '80', count: 2 },
        ],
        'ru',
      ).values,
    ).toEqual([
      { value: '60', label: '60', count: 3 },
      { value: '80', label: '80', count: 2 },
      { value: '100', label: '100', count: 1 },
    ]);
  });
});
