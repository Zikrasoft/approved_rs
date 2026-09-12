import { describe, it, expect } from 'vitest';
import {
  buildFitmentIndex,
  fitmentMatches,
  formatDimensions,
  localizedProduct,
  publishedProducts,
  type FitmentEntry,
  type Product,
} from './products';

const FITMENT: FitmentEntry[] = [
  { make: 'Volkswagen', model: 'Golf', yearFrom: 2012, yearTo: 2019 },
  { make: 'Škoda', model: 'Octavia', yearFrom: 2013, yearTo: 2020 },
];

function makeProduct(
  over: Partial<Product['data']> = {},
  body = 'RU body',
): Product {
  return {
    id: 'battery-60',
    body,
    data: {
      title: 'Аккумулятор 60 Ah',
      brand: 'Bosch',
      price: 95,
      capacityAh: 60,
      crankingA: 540,
      polarity: 'left',
      lengthMm: 242,
      widthMm: 175,
      heightMm: 190,
      warrantyMonths: 24,
      inStock: true,
      fitment: FITMENT,
      published: true,
      ...over,
    },
  } as unknown as Product;
}

describe('fitmentMatches', () => {
  it('matches everything when no filter is set', () => {
    expect(fitmentMatches(FITMENT, {})).toBe(true);
  });

  it('matches on make alone', () => {
    expect(fitmentMatches(FITMENT, { make: 'Volkswagen' })).toBe(true);
    expect(fitmentMatches(FITMENT, { make: 'BMW' })).toBe(false);
  });

  it('requires make and model to belong to the same entry', () => {
    expect(
      fitmentMatches(FITMENT, { make: 'Volkswagen', model: 'Octavia' }),
    ).toBe(false);
  });

  it('includes both boundary years', () => {
    const filter = { make: 'Volkswagen', model: 'Golf' };
    expect(fitmentMatches(FITMENT, { ...filter, year: 2012 })).toBe(true);
    expect(fitmentMatches(FITMENT, { ...filter, year: 2019 })).toBe(true);
  });

  it('excludes a year outside the range', () => {
    const filter = { make: 'Volkswagen', model: 'Golf' };
    expect(fitmentMatches(FITMENT, { ...filter, year: 2011 })).toBe(false);
    expect(fitmentMatches(FITMENT, { ...filter, year: 2020 })).toBe(false);
  });

  it('never matches a product with no fitment data when a filter is set', () => {
    expect(fitmentMatches([], { make: 'Volkswagen' })).toBe(false);
  });

  it('never matches an inverted year range', () => {
    const inverted: FitmentEntry[] = [
      { make: 'BMW', model: 'X5', yearFrom: 2020, yearTo: 2010 },
    ];
    expect(fitmentMatches(inverted, { make: 'BMW', year: 2015 })).toBe(false);
  });
});

describe('buildFitmentIndex', () => {
  it('collects makes, models and years without duplicates', () => {
    const index = buildFitmentIndex([
      makeProduct(),
      makeProduct({
        fitment: [
          { make: 'Volkswagen', model: 'Golf', yearFrom: 2015, yearTo: 2021 },
        ],
      }),
    ]);
    expect(index.makes).toEqual(['Volkswagen', 'Škoda']);
    expect(index.modelsByMake.Volkswagen).toEqual(['Golf']);
    expect(index.yearsByModel['Volkswagen|Golf']).toContain(2021);
    expect(new Set(index.yearsByModel['Volkswagen|Golf']).size).toBe(
      index.yearsByModel['Volkswagen|Golf'].length,
    );
  });

  it('lists years newest first, the order a buyer scans', () => {
    const index = buildFitmentIndex([makeProduct()]);
    const years = index.yearsByModel['Volkswagen|Golf'];
    expect(years[0]).toBe(2019);
    expect(years.at(-1)).toBe(2012);
  });

  it('ignores an inverted year range rather than silently matching nothing forever', () => {
    const index = buildFitmentIndex([
      makeProduct({
        fitment: [{ make: 'BMW', model: 'X5', yearFrom: 2020, yearTo: 2010 }],
      }),
    ]);
    expect(index.makes).toEqual(['BMW']);
    expect(index.yearsByModel['BMW|X5']).toEqual([]);
  });

  it('returns an empty index for a catalogue with no fitment data', () => {
    expect(buildFitmentIndex([makeProduct({ fitment: [] })])).toEqual({
      makes: [],
      modelsByMake: {},
      yearsByModel: {},
    });
  });
});

describe('publishedProducts', () => {
  it('drops unpublished entries', () => {
    expect(
      publishedProducts([makeProduct({ published: false }), makeProduct()]),
    ).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const cheap = makeProduct({ price: 70 });
    const dear = makeProduct({ price: 150 });
    const input = [dear, cheap];
    publishedProducts(input);
    expect(input[0]).toBe(dear);
  });

  it('sorts cheapest first', () => {
    const cheap = makeProduct({ price: 70 });
    const dear = makeProduct({ price: 150 });
    expect(publishedProducts([dear, cheap])[0]).toBe(cheap);
  });
});

describe('localizedProduct', () => {
  it('returns the ru source for the default locale', () => {
    expect(localizedProduct(makeProduct(), 'ru').title).toBe(
      'Аккумулятор 60 Ah',
    );
  });

  it('returns the translation when one exists', () => {
    const product = makeProduct({
      translations: { en: { title: 'Battery 60 Ah', body: 'EN body' } },
    });
    expect(localizedProduct(product, 'en').title).toBe('Battery 60 Ah');
  });

  it('falls back to ru rather than rendering a half-written translation', () => {
    const product = makeProduct({
      translations: { sr: { title: 'Akumulator', body: '  ' } },
    });
    expect(localizedProduct(product, 'sr').title).toBe('Аккумулятор 60 Ah');
  });
});

describe('formatDimensions', () => {
  it('renders length by width by height without a unit', () => {
    expect(formatDimensions(makeProduct().data)).toBe('242 × 175 × 190');
  });
});
