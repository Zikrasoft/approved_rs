import { describe, expect, it } from 'vitest';
import type { PartPageEntry } from './catalogueSnapshot';
import type { CataloguePages } from './paths';
import type { Work } from './works';
import { cacheKey, linkedVehicles, partCacheKey } from './cacheKey';

const vehicle = (slug: string) =>
  ({
    id: slug,
    slug,
    model: { slug: 'x5', chassis: { series: { make: { slug: 'bmw' } } } },
  }) as unknown as PartPageEntry['fits'][number]['vehicle'];

const part = (value: string, overrides: Partial<PartPageEntry> = {}) =>
  ({
    slug: `bosch-${value}`,
    value,
    normalized_value: value,
    brand: { name: 'Bosch', slug: 'bosch' },
    part: { name: 'Filter' },
    equivalents: [],
    fits: [{ vehicle: vehicle('e70') }],
    requirementCars: [],
    kitCars: [],
    offers: [],
    ...overrides,
  }) as unknown as PartPageEntry;

const work = (id: string, number: string, title = 'Замена фильтра') =>
  ({
    id,
    body: 'RU body',
    data: {
      title,
      published: true,
      image: { src: '/image.jpg' },
      date: new Date('2026-01-01'),
      parts: [{ brand: 'Bosch', number }],
      servicesApplied: [],
    },
  }) as unknown as Work;

const places = (vehicles: string[]): CataloguePages => ({
  makes: new Set(['bmw']),
  models: new Set(['bmw/x5']),
  categories: new Set(),
  vehicles: new Set(vehicles),
});

const keyFor = (
  page: PartPageEntry,
  {
    others = [] as PartPageEntry[],
    works = [] as Work[],
    vehicles = ['bmw/x5/e70'],
  } = {},
) =>
  partCacheKey(
    { page, successor: null, replacements: [] },
    {
      bySlug: new Map([page, ...others].map((entry) => [entry.slug, entry])),
      places: places(vehicles),
      works,
    },
  );

describe('cacheKey', () => {
  it('gives the same data the same key', () => {
    expect(cacheKey({ a: [1, 2], b: new Set(['y', 'x']) })).toBe(
      cacheKey({ a: [1, 2], b: new Set(['x', 'y']) }),
    );
  });

  it('gives changed data a new key', () => {
    expect(cacheKey({ price: 100 })).not.toBe(cacheKey({ price: 120 }));
  });

  it('reads through Maps and Sets', () => {
    expect(cacheKey(new Map([['a', 1]]))).not.toBe(
      cacheKey(new Map([['a', 2]])),
    );
    expect(cacheKey(new Set(['a']))).not.toBe(cacheKey(new Set(['b'])));
  });
});

describe('linkedVehicles', () => {
  it('says which vehicles have a page', () => {
    expect(
      linkedVehicles(places(['bmw/x5/e70']), [vehicle('e70'), vehicle('f15')]),
    ).toEqual([true, false]);
  });
});

describe('partCacheKey', () => {
  const page = part('0451103316', {
    equivalents: [{ brand: { slug: 'bosch' }, normalized_value: '111' }],
  } as Partial<PartPageEntry>);
  const equivalent = part('111');

  it('is stable for unchanged data', () => {
    expect(keyFor(page, { others: [equivalent] })).toBe(
      keyFor(page, { others: [equivalent] }),
    );
  });

  it('changes when the part changes', () => {
    expect(keyFor(page)).not.toBe(
      keyFor({ ...page, priceOnRequest: !page.priceOnRequest }),
    );
  });

  it('ignores a part the page does not show', () => {
    expect(keyFor(page, { others: [equivalent] })).toBe(
      keyFor(page, { others: [equivalent, part('999')] }),
    );
  });

  it('changes when a shown equivalent changes', () => {
    expect(keyFor(page, { others: [equivalent] })).not.toBe(
      keyFor(page, {
        others: [part('111', { offers: [{ price: 5 }] } as never)],
      }),
    );
  });

  it('changes when a fitted vehicle gains or loses its page', () => {
    expect(keyFor(page)).not.toBe(keyFor(page, { vehicles: [] }));
  });

  it('changes when a Work that sourced the part changes, and only then', () => {
    const sourcing = work('x5-filter', '0451103316');
    const unrelated = work('golf', '999');
    expect(keyFor(page, { works: [sourcing] })).toBe(
      keyFor(page, { works: [sourcing, unrelated] }),
    );
    expect(keyFor(page, { works: [sourcing] })).not.toBe(
      keyFor(page, {
        works: [work('x5-filter', '0451103316', 'Новый заголовок')],
      }),
    );
  });
});
