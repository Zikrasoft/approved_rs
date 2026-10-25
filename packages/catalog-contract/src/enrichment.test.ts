import { describe, expect, it } from 'vitest';
import { enrichmentGaps, type EnrichmentFacts } from './enrichment.ts';

const bare: EnrichmentFacts = {
  description: null,
  attributes: {},
  fitments: 0,
  equivalents: 0,
};

describe('enrichmentGaps', () => {
  it.each<[string, Partial<EnrichmentFacts>]>([
    ['a description', { description: 'Фильтр для двигателей N52' }],
    ['an attribute', { attributes: { volume: 5 } }],
    ['a yes-or-no attribute set to no', { attributes: { heated: false } }],
    ['a Fitment', { fitments: 2 }],
    ['a published equivalent', { equivalents: 1 }],
  ])('passes a brand-number with %s', (_, facts) => {
    expect(enrichmentGaps({ ...bare, ...facts })).toEqual([]);
  });

  it('fails a bare brand-number', () => {
    expect(enrichmentGaps(bare)).toEqual(['bare_number']);
  });

  it.each<[string, Partial<EnrichmentFacts>]>([
    ['a blank description', { description: '  ' }],
    ['an empty attribute list', { attributes: { approvals: [] } }],
    ['a blank attribute', { attributes: { color: '' } }],
  ])('fails a brand-number with only %s', (_, facts) => {
    expect(enrichmentGaps({ ...bare, ...facts })).toEqual(['bare_number']);
  });
});
