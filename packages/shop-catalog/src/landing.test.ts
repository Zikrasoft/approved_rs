import { describe, it, expect } from 'vitest';
import { LANDING_MIN_PRODUCTS, landingPages, landingSlug } from './landing.ts';
import { productType, type ProductTypeDef, type Spec } from './registry.ts';

const batteries = productType('batteries')!;
const filters = productType('filters')!;

const times = (count: number, spec: Spec): Spec[] =>
  Array.from({ length: count }, () => spec);

const codesType: ProductTypeDef = {
  key: 'codes',
  label: 'Codes',
  fitment: 'none',
  fields: [
    {
      kind: 'codes',
      key: 'approvals',
      label: 'A',
      multiple: true,
      facet: true,
      landing: true,
    },
    { kind: 'boolean', key: 'sealed', label: 'S' },
  ],
};

describe('landingSlug', () => {
  it('appends the unit to a number', () => {
    expect(landingSlug(batteries.fields[1], 60)).toBe('60ah');
  });

  it('turns codes and enum values into URL-safe slugs', () => {
    const field = codesType.fields[0];
    expect(landingSlug(field, 'VW 504.00')).toBe('vw-504-00');
    expect(landingSlug(field, '5W-30')).toBe('5w-30');
    expect(landingSlug(field, 'Škoda  Original')).toBe('skoda-original');
  });
});

describe('landingPages', () => {
  it('uses a threshold of three products by default', () => {
    expect(LANDING_MIN_PRODUCTS).toBe(3);
  });

  it('keeps only values with enough products, numbers ascending', () => {
    const specs = [
      ...times(3, { capacityAh: 74 }),
      ...times(2, { capacityAh: 70 }),
      ...times(3, { capacityAh: 60 }),
    ];
    expect(landingPages(batteries, specs)).toEqual([
      { slug: '60ah', key: 'capacityAh', value: 60 },
      { slug: '74ah', key: 'capacityAh', value: 74 },
    ]);
  });

  it('honours a custom threshold', () => {
    expect(landingPages(batteries, times(2, { capacityAh: 70 }), 2)).toEqual([
      { slug: '70ah', key: 'capacityAh', value: 70 },
    ]);
  });

  it('orders enum landings by the registry', () => {
    const specs = [
      ...times(3, { filterKind: 'cabin' }),
      ...times(3, { filterKind: 'oil' }),
    ];
    expect(landingPages(filters, specs).map((page) => page.slug)).toEqual([
      'oil',
      'cabin',
    ]);
  });

  it('counts a product once per code and sorts codes alphabetically', () => {
    const specs = [
      { approvals: ['VW 504.00', 'VW 504.00', 'ACEA C3'] },
      { approvals: ['VW 504.00', 'ACEA C3'] },
      { approvals: ['VW 504.00', 'ACEA C3'] },
      { approvals: ['VW 502.00'], sealed: true },
    ];
    expect(landingPages(codesType, specs)).toEqual([
      { slug: 'acea-c3', key: 'approvals', value: 'ACEA C3' },
      { slug: 'vw-504-00', key: 'approvals', value: 'VW 504.00' },
    ]);
  });

  it('fails loudly when two values slug the same', () => {
    const specs = [
      ...times(3, { approvals: ['5W-30'] }),
      ...times(3, { approvals: ['5w 30'] }),
    ];
    expect(() => landingPages(codesType, specs)).toThrow(
      /^landing slug "5w-30" is empty or taken in codes \(approvals=5W-30\)$/,
    );
  });

  it('fails loudly when a value slugs to nothing', () => {
    expect(() =>
      landingPages(codesType, times(3, { approvals: ['—'] })),
    ).toThrow('landing slug "" is empty or taken in codes (approvals=—)');
  });

  it('ignores fields that do not offer landings and products without the value', () => {
    expect(landingPages(batteries, times(5, { brand: 'Bosch' }))).toEqual([]);
  });
});
