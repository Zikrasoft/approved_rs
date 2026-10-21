import { describe, expect, it } from 'vitest';
import { partPageSchema } from './partPages.ts';

const page = {
  id: 'pi_1',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  part: { id: 'part_1', name: 'Oil filter' },
  equivalents: [],
  has_offers: false,
};

describe('partPageSchema', () => {
  it('accepts a brand-number page', () => {
    expect(partPageSchema.parse(page)).toEqual(page);
  });

  it('refuses a page that does not say whether it has offers', () => {
    expect(
      partPageSchema.safeParse({ ...page, has_offers: undefined }).success,
    ).toBe(false);
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
