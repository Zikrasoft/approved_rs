import { describe, expect, it } from 'vitest';
import {
  CATALOG_LOCALES,
  facetFilter,
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
  count: 1,
  offset: 0,
  limit: 20,
};

describe('searchResponseSchema', () => {
  it('accepts a list of brand-numbers with their facets', () => {
    expect(searchResponseSchema.parse(response)).toEqual(response);
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
