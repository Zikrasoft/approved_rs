import { describe, expect, it } from 'vitest';
import { productType } from '@podbor/shop-catalog/browser';
import { facetTypeDef } from './facetTypeDef';

describe('facetTypeDef', () => {
  it('keeps only facet fields, strips labels, keeps enum values without labels', () => {
    const def = facetTypeDef(productType('batteries')!);

    expect(def.fitment).toBe('optional');
    expect(def.fields.map((field) => field.key)).toEqual([
      'brand',
      'capacityAh',
      'crankingA',
      'polarity',
      'technology',
    ]);
    expect(def.fields.find((field) => field.key === 'polarity')).toEqual({
      key: 'polarity',
      kind: 'enum',
      facet: true,
      values: [{ value: 'left' }, { value: 'right' }],
    });
    expect(JSON.stringify(def)).not.toContain('Обратная');
  });

  it('omits non-facet fields entirely', () => {
    const def = facetTypeDef(productType('batteries')!);

    expect(def.fields.some((field) => field.key === 'lengthMm')).toBe(false);
  });

  it('keeps non-enum kinds without a values array', () => {
    const def = facetTypeDef(productType('batteries')!);

    expect(def.fields.find((field) => field.key === 'capacityAh')).toEqual({
      key: 'capacityAh',
      kind: 'number',
      facet: true,
    });
  });
});
