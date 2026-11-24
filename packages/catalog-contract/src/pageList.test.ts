import { describe, expect, it } from 'vitest';

import { cataloguePageListSchema } from './pageList.ts';

const list = {
  parts: [{ slug: 'bmw-11428575211', indexable: true }],
  makes: [{ slug: 'bmw', name: 'BMW', hub: true }],
  series: [
    { make: 'bmw', slug: '3-series', name: '3 Series', categories: ['brakes'] },
  ],
  categories: [{ slug: 'brakes', name: 'Brakes', listed: 4 }],
};

describe('cataloguePageListSchema', () => {
  it('reads the list and strips a key a newer shop adds', () => {
    expect(
      cataloguePageListSchema.parse({
        ...list,
        generated_at: 'now',
        parts: [{ ...list.parts[0], noindex_reason: 'bare_number' }],
      }),
    ).toEqual(list);
  });

  it('reads a Category without the count an older shop leaves out as null', () => {
    const { listed: _listed, ...older } = list.categories[0];
    expect(
      cataloguePageListSchema.parse({ ...list, categories: [older] })
        .categories[0].listed,
    ).toBeNull();
  });

  it('refuses a list without its Parts', () => {
    const { parts: _parts, ...broken } = list;
    expect(cataloguePageListSchema.safeParse(broken).success).toBe(false);
  });
});
