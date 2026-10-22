import { describe, expect, it } from 'vitest';
import type { VehicleRequirement } from './attributes.ts';
import { enrichmentRule, type EnrichmentFacts } from './enrichment.ts';

const requirement = (
  overrides: Partial<VehicleRequirement>,
): VehicleRequirement => ({
  id: 'requirement',
  category_id: 'category_oil',
  field_key: 'approvals',
  option_keys: ['bmw-ll-04'],
  min: null,
  max: null,
  quantity: 1,
  ...overrides,
});

const bare: EnrichmentFacts = {
  category_id: 'category_oil',
  attributes: {},
  fitments: 0,
  equivalents: 0,
};

const bmw = {
  requirements: [
    requirement({}),
    requirement({ field_key: 'volume', option_keys: null, min: 4, max: 6 }),
    requirement({ category_id: 'category_wiper', field_key: 'length' }),
  ],
};

describe('enrichmentRule', () => {
  const gaps = enrichmentRule([bmw, { requirements: [] }]);

  it('passes a categorised brand-number that fits a Vehicle', () => {
    expect(gaps({ ...bare, fitments: 2 })).toEqual([]);
  });

  it('passes a categorised brand-number with a published equivalent', () => {
    expect(gaps({ ...bare, equivalents: 1 })).toEqual([]);
  });

  it('passes a categorised brand-number meeting every Requirement of a Vehicle in its Category', () => {
    expect(
      gaps({ ...bare, attributes: { approvals: ['bmw-ll-04'], volume: 5 } }),
    ).toEqual([]);
  });

  it('fails a brand-number meeting only some of those Requirements', () => {
    expect(gaps({ ...bare, attributes: { approvals: ['bmw-ll-04'] } })).toEqual(
      ['no_fitment_equivalent_or_requirement'],
    );
  });

  it('fails a brand-number whose Category no Vehicle requires', () => {
    expect(gaps({ ...bare, category_id: 'category_brakes' })).toEqual([
      'no_fitment_equivalent_or_requirement',
    ]);
  });

  it('fails a brand-number without a Category however much else it has', () => {
    expect(
      gaps({
        category_id: null,
        attributes: { approvals: ['bmw-ll-04'], volume: 5 },
        fitments: 3,
        equivalents: 2,
      }),
    ).toEqual(['no_category']);
  });

  it('names both gaps for a bare brand-number', () => {
    expect(gaps({ ...bare, category_id: null })).toEqual([
      'no_category',
      'no_fitment_equivalent_or_requirement',
    ]);
  });
});
