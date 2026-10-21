import { describe, expect, it } from 'vitest';
import { partPageSchema } from './partPages.ts';

const page = {
  id: 'pi_1',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  part: { id: 'part_1', name: 'Oil filter', replaced_by: null },
  equivalents: [],
};

describe('partPageSchema', () => {
  it('accepts a brand-number page', () => {
    expect(partPageSchema.parse(page)).toEqual(page);
  });

  it('accepts a superseded number whose Part has a replacement', () => {
    const replaced = {
      ...page,
      superseded: true,
      part: {
        ...page.part,
        replaced_by: {
          id: 'part_2',
          name: 'Oil filter, revised',
          brand_number: {
            id: 'pi_2',
            type: 'manufacturer-number',
            value: 'HU 816 z',
            normalized_value: 'HU816Z',
            superseded: false,
            brand: page.brand,
          },
        },
      },
    };
    expect(partPageSchema.parse(replaced)).toEqual(replaced);
  });

  it.each(['Mann Filter', 'mann--filter', '-mann', ''])(
    'refuses the Brand slug %j',
    (slug) => {
      expect(
        partPageSchema.safeParse({ ...page, brand: { ...page.brand, slug } })
          .success,
      ).toBe(false);
    },
  );
});
