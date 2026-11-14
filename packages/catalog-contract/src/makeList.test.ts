import { describe, expect, it } from 'vitest';
import { makeListSchema, sameMakeName, sortedMakes } from './makeList.ts';

describe('the Make list', () => {
  it('reads each Make as its slug and name, dropping a key a newer shop adds', () => {
    expect(
      makeListSchema.parse([{ slug: 'bmw', name: 'BMW', country: 'de' }]),
    ).toEqual([{ slug: 'bmw', name: 'BMW' }]);
  });

  it.each([
    [{ slug: '', name: 'BMW' }],
    [{ slug: 'bmw', name: '' }],
    [{ slug: 'bmw' }],
  ])('refuses a Make without a slug or a name: %j', (make) => {
    expect(makeListSchema.safeParse([make]).success).toBe(false);
  });

  it('orders Makes by name, ignoring case and accents, and keeps only slug and name', () => {
    expect(
      sortedMakes([
        { slug: 'skoda', name: 'Škoda' },
        { slug: 'bmw', name: 'BMW' },
        { slug: 'seat', name: 'SEAT' },
        { slug: 'alfa-romeo', name: 'alfa romeo' },
        { slug: 'audi', name: 'Audi', id: 'make_1' } as never,
      ]),
    ).toEqual([
      { slug: 'alfa-romeo', name: 'alfa romeo' },
      { slug: 'audi', name: 'Audi' },
      { slug: 'bmw', name: 'BMW' },
      { slug: 'seat', name: 'SEAT' },
      { slug: 'skoda', name: 'Škoda' },
    ]);
  });

  it('takes two names that differ only in case or accents for one Make', () => {
    expect(sameMakeName('ŠKODA', 'Skoda')).toBe(true);
    expect(sameMakeName('Seat', 'Skoda')).toBe(false);
  });
});
