import { describe, expect, it } from 'vitest';
import {
  BRAND_FACET,
  CATALOG_LOCALES,
  IN_STOCK,
  IN_STOCK_FACET,
  PRICE_FACET,
  UNIVERSAL_FACET_KEYS,
  universalFacets,
  usefulFacets,
  describeFacet,
  facetFilter,
  inRange,
  parseRangeFilter,
  rangeFilter,
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
      thumbnail: 'https://api.carlab.rs/static/parts/a-160.webp',
    },
  ],
  facets: [
    {
      key: 'viscosity',
      type: 'single-select',
      label: 'Viskozitet',
      unit: null,
      values: [{ value: '5w-30', label: '5W-30', count: 1 }],
    },
  ],
  category: null,
  model: null,
  cars: [],
  count: 1,
  offset: 0,
  limit: 20,
};

const bmwX3 = {
  slug: 'e83-x3-20d',
  name: 'X3 2.0d',
  chassis: {
    code: 'E83',
    body_style: 'suv',
    series: {
      name: 'X3',
      translations: null,
      make: { slug: 'bmw', name: 'BMW' },
    },
  },
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

  it('names the Model a listing was scoped to', () => {
    const scoped = {
      ...response,
      model: {
        slug: 'f30-320d',
        name: '320d',
        chassis: {
          code: 'F30',
          body_style: 'sedan',
          series: {
            name: '3 серия',
            translations: { en: '3 Series' },
            make: { slug: 'bmw', name: 'BMW' },
          },
        },
      },
    };
    expect(searchResponseSchema.parse(scoped)).toEqual(scoped);
  });

  it('reads a response from a backend that predates the Model as unscoped', () => {
    const { model: _model, ...older } = response;
    expect(searchResponseSchema.parse(older).model).toBeNull();
  });

  it('names the Makes, Models and Vehicles the query matched', () => {
    const cars = [
      {
        kind: 'make',
        make: { slug: 'bmw', name: 'BMW' },
        model: null,
        vehicle: null,
      },
      {
        kind: 'model',
        make: { slug: 'bmw', name: 'BMW' },
        model: bmwX3,
        vehicle: null,
      },
      {
        kind: 'vehicle',
        make: { slug: 'bmw', name: 'BMW' },
        model: bmwX3,
        vehicle: {
          id: 'veh_1',
          slug: 'n47-130kw',
          engine: { code: 'N47D20' },
          power_kw: 130,
          year_from: 2007,
          year_to: 2010,
        },
      },
    ];
    expect(searchResponseSchema.parse({ ...response, cars }).cars).toEqual(
      cars,
    );
  });

  it('drops a car it cannot read rather than the whole answer', () => {
    const cars = [
      {
        kind: 'trim',
        make: { slug: 'bmw', name: 'BMW' },
        model: null,
        vehicle: null,
      },
      {
        kind: 'make',
        make: { slug: 'bmw', name: 'BMW' },
        model: null,
        vehicle: null,
      },
    ];
    expect(searchResponseSchema.parse({ ...response, cars }).cars).toEqual([
      cars[1],
    ]);
  });

  it('reads a response from a backend that predates cars as having none', () => {
    const { cars: _cars, ...older } = response;
    expect(searchResponseSchema.parse(older).cars).toEqual([]);
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

describe('range filters', () => {
  it.each([
    ['capacity:60:95', { key: 'capacity', min: 60, max: 95 }],
    ['capacity:60:', { key: 'capacity', min: 60, max: null }],
    ['capacity::95', { key: 'capacity', min: null, max: 95 }],
    ['length:-1.5:2.25', { key: 'length', min: -1.5, max: 2.25 }],
  ])('reads %j and writes it back', (text, range) => {
    expect(parseRangeFilter(text)).toEqual(range);
    expect(rangeFilter(range)).toBe(text);
  });

  it.each(['capacity::', 'capacity:abc:5', 'Capacity:1:2', 'capacity:1'])(
    'refuses %j',
    (text) => {
      expect(parseRangeFilter(text)).toBeNull();
    },
  );

  it('keeps the numbers inside both bounds, bounds included', () => {
    const range = { key: 'capacity', min: 60, max: 80 };

    expect(
      ['50', '60', '70', '80', '95', 'agm', ''].filter((value) =>
        inRange(value, range),
      ),
    ).toEqual(['60', '70', '80']);
    expect(inRange('1000', { key: 'capacity', min: 60, max: null })).toBe(true);
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
      type: 'single-select',
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

describe('universalFacets', () => {
  it('describes brand, availability and price, in that order', () => {
    expect(
      universalFacets({
        brands: [
          { value: 'mann-filter', label: 'Mann-Filter', count: 2 },
          { value: 'ate', label: 'ATE', count: 1 },
        ],
        inStock: 2,
        price: { min: 900, max: 2400, count: 3 },
        currency: 'RSD',
      }),
    ).toEqual([
      {
        key: BRAND_FACET,
        type: 'single-select',
        label: BRAND_FACET,
        unit: null,
        values: [
          { value: 'ate', label: 'ATE', count: 1 },
          { value: 'mann-filter', label: 'Mann-Filter', count: 2 },
        ],
      },
      {
        key: IN_STOCK_FACET,
        type: 'boolean',
        label: IN_STOCK_FACET,
        unit: null,
        values: [{ value: IN_STOCK, label: IN_STOCK, count: 2 }],
      },
      {
        key: PRICE_FACET,
        type: 'number',
        label: PRICE_FACET,
        unit: 'RSD',
        values: [
          { value: '900', label: '900', count: 3 },
          { value: '2400', label: '2400', count: 3 },
        ],
      },
    ]);
  });

  it('gives one price value when every price is the same, none without prices', () => {
    const [, , single] = universalFacets({
      brands: [],
      inStock: 0,
      price: { min: 1200, max: 1200, count: 2 },
      currency: 'RSD',
    });
    const [, , none] = universalFacets({
      brands: [],
      inStock: 0,
      price: null,
      currency: 'RSD',
    });

    expect(single.values).toEqual([{ value: '1200', label: '1200', count: 2 }]);
    expect(none.values).toEqual([]);
  });

  it('reserves its keys', () => {
    expect(UNIVERSAL_FACET_KEYS).toEqual(['brand', 'in-stock', 'price']);
  });
});

describe('usefulFacets', () => {
  const facet = (key: string, counts: number[]) => ({
    key,
    type: 'single-select' as const,
    label: key,
    unit: null,
    values: counts.map((count, index) => ({
      value: String(index),
      label: String(index),
      count,
    })),
  });

  it('drops a facet every result shares one value of, or with nothing counted', () => {
    const facets = [
      facet('shared', [5]),
      facet('empty', []),
      facet('zero', [0]),
      facet('split', [3, 2]),
      facet('partial', [3]),
    ];

    expect(usefulFacets(facets, 5, []).map(({ key }) => key)).toEqual([
      'split',
      'partial',
    ]);
  });

  it('drops a number range with one value even when some results lack it', () => {
    const range = { ...facet('height', [2]), type: 'number' as const };

    expect(usefulFacets([range], 5, [])).toEqual([]);
  });

  it('keeps a facet with an active selection', () => {
    expect(
      usefulFacets([facet('shared', [5]), facet('zero', [0])], 5, [
        'shared',
        'zero',
      ]).map(({ key }) => key),
    ).toEqual(['shared', 'zero']);
  });
});
