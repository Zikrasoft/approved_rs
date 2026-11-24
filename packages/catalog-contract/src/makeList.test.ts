import { describe, expect, it } from 'vitest';
import { makeListSchema, sortedMakes } from './makeList.ts';

describe('the Make list', () => {
  it('reads each Make as its slug, name and site flag, dropping a key a newer shop adds', () => {
    expect(
      makeListSchema.parse([
        { slug: 'bmw', name: 'BMW', show_on_site: true, country: 'de' },
      ]),
    ).toEqual([{ slug: 'bmw', name: 'BMW', show_on_site: true }]);
  });

  it('reads a Make from a shop that does not send the site flag yet as unflagged', () => {
    expect(makeListSchema.parse([{ slug: 'bmw', name: 'BMW' }])).toEqual([
      { slug: 'bmw', name: 'BMW', show_on_site: null },
    ]);
  });

  it.each([
    [{ slug: '', name: 'BMW' }],
    [{ slug: 'bmw', name: '' }],
    [{ slug: 'bmw' }],
    [{ slug: 'bmw', name: 'BMW', show_on_site: 'yes' }],
  ])(
    'refuses a Make without a slug or a name, or with a flag that is not a boolean: %j',
    (make) => {
      expect(makeListSchema.safeParse([make]).success).toBe(false);
    },
  );

  it('orders Makes by name, ignoring case and accents, and keeps only slug, name and flag', () => {
    expect(
      sortedMakes([
        { slug: 'skoda', name: 'Škoda', show_on_site: null },
        { slug: 'bmw', name: 'BMW', show_on_site: true },
        { slug: 'seat', name: 'SEAT', show_on_site: false },
        { slug: 'alfa-romeo', name: 'alfa romeo', show_on_site: null },
        {
          slug: 'audi',
          name: 'Audi',
          show_on_site: false,
          id: 'make_1',
        } as never,
      ]),
    ).toEqual([
      { slug: 'alfa-romeo', name: 'alfa romeo', show_on_site: null },
      { slug: 'audi', name: 'Audi', show_on_site: false },
      { slug: 'bmw', name: 'BMW', show_on_site: true },
      { slug: 'seat', name: 'SEAT', show_on_site: false },
      { slug: 'skoda', name: 'Škoda', show_on_site: null },
    ]);
  });
});
