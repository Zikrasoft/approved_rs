import { describe, expect, it } from 'vitest';
import { universalFacets } from '@podbor/catalog-contract';
import {
  appendRange,
  chosenFilters,
  facetValueLabel,
  numberBounds,
  rangesFromParams,
  rangeText,
  withFacetCopy,
} from './partsSearch';

const copy = {
  booleanTrue: 'да',
  booleanFalse: 'нет',
  rangeFrom: 'от {min}',
  rangeTo: 'до {max}',
  rangeBetween: 'от {min} до {max}',
};
const capacity = {
  key: 'capacity',
  type: 'number' as const,
  label: 'Емкость',
  unit: 'Ah',
  values: [
    { value: '60', label: '60', count: 0 },
    { value: '80', label: '80', count: 2 },
    { value: '95', label: '95', count: 1 },
  ],
};
const viscosity = {
  key: 'viscosity',
  type: 'single-select' as const,
  label: 'Вязкость',
  unit: null,
  values: [{ value: '5w-30', label: '5W-30', count: 1 }],
};

describe('facetValueLabel', () => {
  it('prefers the option label, then yes or no, then the value with its unit', () => {
    expect(facetValueLabel(viscosity, viscosity.values[0], copy)).toBe('5W-30');
    expect(
      facetValueLabel(viscosity, { value: 'true', label: 'true' }, copy),
    ).toBe('да');
    expect(
      facetValueLabel(viscosity, { value: 'false', label: 'false' }, copy),
    ).toBe('нет');
    expect(facetValueLabel(capacity, capacity.values[1], copy)).toBe('80 Ah');
    expect(facetValueLabel(viscosity, { value: '4', label: '4' }, copy)).toBe(
      '4',
    );
  });
});

describe('number ranges in the page address', () => {
  it('reads both bounds, one bound, swapped bounds and a decimal comma', () => {
    expect(
      rangesFromParams(
        new URLSearchParams(
          'min.capacity=70&max.capacity=95&min.cold-cranking=600&max.length=&min.height=300&max.height=200&min.voltage=12,5',
        ),
      ),
    ).toEqual([
      { key: 'capacity', min: 70, max: 95 },
      { key: 'cold-cranking', min: 600, max: null },
      { key: 'height', min: 200, max: 300 },
      { key: 'voltage', min: 12.5, max: null },
    ]);
  });

  it('ignores empty bounds, words and malformed field keys', () => {
    expect(
      rangesFromParams(
        new URLSearchParams('min.capacity=&max.capacity=abc&min.Bad Key=5'),
      ),
    ).toEqual([]);
  });

  it('ignores a negative bound, which no part attribute has', () => {
    expect(
      rangesFromParams(new URLSearchParams('min.capacity=-5&max.length=-1')),
    ).toEqual([]);
  });

  it('writes a range back as the bounds it has', () => {
    const params = new URLSearchParams();
    appendRange(params, { key: 'capacity', min: 70, max: null });
    appendRange(params, { key: 'length', min: null, max: 300 });

    expect(params.toString()).toBe('min.capacity=70&max.length=300');
  });
});

describe('numberBounds', () => {
  it('finds the smallest and largest value a number facet has', () => {
    expect(numberBounds(capacity)).toEqual({ min: 60, max: 95 });
    expect(numberBounds(viscosity)).toBeNull();
  });
});

describe('rangeText', () => {
  it('says from, to, between or one value, with the unit', () => {
    expect(rangeText({ min: 70, max: 95 }, 'Ah', copy)).toBe('от 70 до 95 Ah');
    expect(rangeText({ min: 70, max: null }, null, copy)).toBe('от 70');
    expect(rangeText({ min: null, max: 95 }, 'Ah', copy)).toBe('до 95 Ah');
    expect(rangeText({ min: 80, max: 80 }, 'Ah', copy)).toBe('80 Ah');
  });
});

describe('chosenFilters', () => {
  it('names each chosen filter and range and what is left without it', () => {
    const range = { key: 'capacity', min: 70, max: 95 };
    const lost = { key: 'gone', min: 1, max: null };

    expect(
      chosenFilters(
        [viscosity, capacity],
        ['viscosity:5w-30', 'viscosity:0w-20'],
        [range, lost],
        copy,
      ),
    ).toEqual([
      {
        facets: ['viscosity:0w-20'],
        ranges: [range, lost],
        label: 'Вязкость: 5W-30',
      },
      {
        facets: ['viscosity:5w-30'],
        ranges: [range, lost],
        label: '0w-20',
      },
      {
        facets: ['viscosity:5w-30', 'viscosity:0w-20'],
        ranges: [lost],
        label: 'Емкость: от 70 до 95 Ah',
      },
      {
        facets: ['viscosity:5w-30', 'viscosity:0w-20'],
        ranges: [range],
        label: 'от 1',
      },
    ]);
  });
});

describe('withFacetCopy', () => {
  it('names the brand, availability and price facets in the page language', () => {
    const facets = universalFacets({
      brands: [{ value: 'ate', label: 'ATE', count: 1 }],
      inStock: 2,
      price: { min: 900, max: 900, count: 1 },
      currency: 'RSD',
    });

    expect(
      withFacetCopy([...facets, viscosity], {
        brandFacet: 'Бренд',
        availabilityFacet: 'Наличие',
        inStockOnly: 'Только в наличии',
        priceFacet: 'Цена',
      }).map(({ label, values }) => [label, values[0].label]),
    ).toEqual([
      ['Бренд', 'ATE'],
      ['Наличие', 'Только в наличии'],
      ['Цена', '900'],
      ['Вязкость', '5W-30'],
    ]);
  });
});
