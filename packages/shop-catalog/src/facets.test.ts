import { describe, it, expect } from 'vitest';
import {
  facetIndex,
  matchesFacets,
  readFacetState,
  writeFacetState,
} from './facets.ts';
import { productType, type ProductTypeDef, type Spec } from './registry.ts';

const oils = productType('motor-oils')!;
const batteries = productType('batteries')!;

const OILS: Spec[] = [
  {
    brand: 'Motul',
    viscosity: '5w-30',
    volumeL: 4,
    base: 'synthetic',
    approvals: ['VW 504.00', 'ACEA C3'],
  },
  {
    brand: 'Castrol',
    viscosity: '5w-30',
    volumeL: 1,
    base: 'synthetic',
    approvals: ['ACEA C3', 'ACEA C3'],
  },
  { brand: 'Motul', viscosity: '0w-20', volumeL: 4, base: 'semi-synthetic' },
];

describe('facetIndex', () => {
  it('lists enum options in registry order with counts, skipping unused ones', () => {
    const viscosity = facetIndex(oils, OILS).find(
      (facet) => facet.key === 'viscosity',
    );
    expect(viscosity).toEqual({
      kind: 'options',
      key: 'viscosity',
      options: [
        { value: '0w-20', count: 1 },
        { value: '5w-30', count: 2 },
      ],
    });
  });

  it('sorts codes alphabetically and counts a product once per code', () => {
    const approvals = facetIndex(oils, OILS).find(
      (facet) => facet.key === 'approvals',
    );
    expect(approvals).toEqual({
      kind: 'options',
      key: 'approvals',
      options: [
        { value: 'ACEA C3', count: 2 },
        { value: 'VW 504.00', count: 1 },
      ],
    });
  });

  it('lists distinct numbers ascending for a range facet', () => {
    const volume = facetIndex(oils, OILS).find(
      (facet) => facet.key === 'volumeL',
    );
    expect(volume).toEqual({ kind: 'range', key: 'volumeL', values: [1, 4] });
  });

  it('keeps registry field order and drops facets no product fills', () => {
    const keys = facetIndex(batteries, [
      { brand: 'Bosch', capacityAh: 60 },
    ]).map((facet) => facet.key);
    expect(keys).toEqual(['brand', 'capacityAh']);
  });

  it('returns nothing for an empty catalogue', () => {
    expect(facetIndex(oils, [])).toEqual([]);
  });
});

describe('matchesFacets', () => {
  const [motul, castrol, semi] = OILS;

  it('matches everything with an empty state', () => {
    expect(OILS.every((spec) => matchesFacets(oils, spec, {}))).toBe(true);
  });

  it('ORs values within one facet', () => {
    const state = { viscosity: { values: ['0w-20', '5w-30'] } };
    expect(OILS.every((spec) => matchesFacets(oils, spec, state))).toBe(true);
  });

  it('ANDs across facets', () => {
    const state = {
      viscosity: { values: ['5w-30'] },
      brand: { values: ['Motul'] },
    };
    expect(matchesFacets(oils, motul, state)).toBe(true);
    expect(matchesFacets(oils, castrol, state)).toBe(false);
    expect(matchesFacets(oils, semi, state)).toBe(false);
  });

  it('matches a multi-code field on any shared code', () => {
    expect(
      matchesFacets(oils, castrol, {
        approvals: { values: ['VW 504.00', 'ACEA C3'] },
      }),
    ).toBe(true);
    expect(
      matchesFacets(oils, semi, { approvals: { values: ['ACEA C3'] } }),
    ).toBe(false);
  });

  it('includes both range bounds and excludes a product without the value', () => {
    expect(matchesFacets(oils, motul, { volumeL: { min: 4, max: 4 } })).toBe(
      true,
    );
    expect(matchesFacets(oils, castrol, { volumeL: { min: 2 } })).toBe(false);
    expect(matchesFacets(oils, castrol, { volumeL: { max: 1 } })).toBe(true);
    expect(matchesFacets(oils, { brand: 'X' }, { volumeL: { min: 1 } })).toBe(
      false,
    );
  });

  it('ignores empty selections, unknown keys and non-filterable fields', () => {
    expect(matchesFacets(oils, motul, { viscosity: { values: [] } })).toBe(
      true,
    );
    expect(matchesFacets(oils, motul, { volumeL: {} })).toBe(true);
    expect(matchesFacets(oils, motul, { nonsense: { values: ['x'] } })).toBe(
      true,
    );
    expect(
      matchesFacets(
        productType('filters')!,
        { brand: 'Mann' },
        { oemNumbers: { values: ['X'] } },
      ),
    ).toBe(true);
  });
});

describe('readFacetState', () => {
  it('reads repeated option params and range params', () => {
    const params = new URLSearchParams(
      'viscosity=5w-30&viscosity=0w-20&volumeL.min=1&volumeL.max=4&brand=Motul',
    );
    expect(readFacetState(oils, params)).toEqual({
      brand: { values: ['Motul'] },
      viscosity: { values: ['5w-30', '0w-20'] },
      volumeL: { min: 1, max: 4 },
    });
  });

  it('keeps a one-sided range', () => {
    expect(readFacetState(oils, new URLSearchParams('volumeL.max=4'))).toEqual({
      volumeL: { max: 4 },
    });
  });

  it('drops hand-edited garbage instead of throwing', () => {
    const params = new URLSearchParams(
      'viscosity=%3Cscript%3E&viscosity=&viscosity=5w-30&viscosity=5w-30&volumeL.min=abc&volumeL.max=&base=&unknown=1&brand=%20',
    );
    expect(readFacetState(oils, params)).toEqual({
      viscosity: { values: ['5w-30'] },
    });
  });

  it('ignores params for fields that are not filters', () => {
    expect(
      readFacetState(
        productType('filters')!,
        new URLSearchParams('oemNumbers=123'),
      ),
    ).toEqual({});
  });
});

describe('writeFacetState', () => {
  it('round-trips through readFacetState in registry order', () => {
    const state = {
      volumeL: { min: 1, max: 4 },
      viscosity: { values: ['5w-30', '0w-20'] },
      approvals: { values: ['ACEA C3'] },
    };
    const params = writeFacetState(oils, state);
    expect(params.toString()).toBe(
      'viscosity=5w-30&viscosity=0w-20&volumeL.min=1&volumeL.max=4&approvals=ACEA+C3',
    );
    expect(readFacetState(oils, params)).toEqual(state);
  });

  it('omits empty selections and non-filter keys', () => {
    const custom: ProductTypeDef = {
      key: 'x',
      label: 'X',
      fitment: 'none',
      fields: [
        { kind: 'number', key: 'n', label: 'N', unit: 'mm', facet: true },
      ],
    };
    expect(
      writeFacetState(custom, { n: {}, other: { values: ['a'] } }).toString(),
    ).toBe('');
    expect(writeFacetState(oils, { viscosity: {} }).toString()).toBe('');
  });
});
