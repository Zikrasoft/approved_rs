import { describe, it, expect } from 'vitest';
import type { PartPageEntry } from './catalogueSnapshot';
import {
  localizedWork,
  publishedWorks,
  sourcedParts,
  sourcingWorks,
  workPrice,
  type Work,
} from './works';

function makeWork(
  overrides: Partial<Work['data']> = {},
  body = 'RU body',
): Work {
  return {
    id: 'bmw-x5',
    body,
    data: {
      title: 'BMW X5 — замена сцепления',
      car: 'BMW X5',
      servicesApplied: [],
      parts: [],
      gallery: [],
      date: new Date('2026-01-01'),
      published: true,
      ...overrides,
    },
  } as unknown as Work;
}

describe('localizedWork', () => {
  it('returns the ru source for the default locale', () => {
    const work = makeWork({
      translations: { en: { title: 'EN', body: 'EN body' } },
    });
    expect(localizedWork(work, 'ru')).toEqual({
      title: 'BMW X5 — замена сцепления',
      body: 'RU body',
      car: 'BMW X5',
    });
  });

  it('returns the translation when one exists', () => {
    const work = makeWork({
      translations: {
        en: { title: 'BMW X5 clutch replacement', body: 'EN body' },
      },
    });
    expect(localizedWork(work, 'en')).toEqual({
      title: 'BMW X5 clutch replacement',
      body: 'EN body',
      car: 'BMW X5',
    });
  });

  it('falls back to ru when the locale has no translation at all', () => {
    expect(localizedWork(makeWork(), 'sr').title).toBe(
      'BMW X5 — замена сцепления',
    );
  });

  it('falls back to ru rather than rendering a half-written translation', () => {
    const work = makeWork({
      translations: { sr: { title: 'BMW X5 zamena kvačila', body: '   ' } },
    });
    expect(localizedWork(work, 'sr')).toEqual({
      title: 'BMW X5 — замена сцепления',
      body: 'RU body',
      car: 'BMW X5',
    });
  });

  it('prefers the translated car when the locale has one', () => {
    const work = makeWork({
      car: 'Обслуживание тормозной системы',
      translations: {
        sr: {
          title: 'Servis kočionog sistema',
          body: 'SR body',
          car: 'Servis kočionog sistema',
        },
      },
    });
    expect(localizedWork(work, 'sr').car).toBe('Servis kočionog sistema');
  });

  it('falls back to the source car when the translation omits it', () => {
    const work = makeWork({
      translations: { sr: { title: 'SR title', body: 'SR body' } },
    });
    expect(localizedWork(work, 'sr')).toEqual({
      title: 'SR title',
      body: 'SR body',
      car: 'BMW X5',
    });
  });

  it('falls back to the source car when the whole translations block is absent', () => {
    expect(localizedWork(makeWork(), 'sr').car).toBe('BMW X5');
  });
});

describe('publishedWorks', () => {
  it('drops unpublished entries', () => {
    const works = [
      makeWork({ published: false }),
      makeWork({ published: true }),
    ];
    expect(publishedWorks(works)).toHaveLength(1);
  });

  it('sorts newest first', () => {
    const older = makeWork({ date: new Date('2025-01-01') });
    const newer = makeWork({ date: new Date('2026-06-01') });
    expect(publishedWorks([older, newer])[0]).toBe(newer);
  });

  it('does not mutate the input array', () => {
    const older = makeWork({ date: new Date('2025-01-01') });
    const newer = makeWork({ date: new Date('2026-06-01') });
    const input = [older, newer];
    publishedWorks(input);
    expect(input[0]).toBe(older);
  });
});

const partPage = (brand: string, value: string, normalized: string) =>
  ({
    slug: `${brand.toLowerCase()}-${normalized.toLowerCase()}`,
    value,
    normalized_value: normalized,
    brand: { name: brand, slug: brand.toLowerCase() },
  }) as unknown as PartPageEntry;

describe('sourcedParts', () => {
  const pages = [partPage('MANN-FILTER', 'HU 816 x', 'HU816X')];

  it('links a Part that has a Part page, matching brand and number loosely', () => {
    const work = makeWork({
      parts: [{ brand: 'Mann-Filter', number: 'hu-816 x' }],
    });
    expect(sourcedParts(work, pages)).toEqual([
      { brand: 'Mann-Filter', number: 'hu-816 x', slug: 'mann-filter-hu816x' },
    ]);
  });

  it('shows a Part without a page as brand and number only', () => {
    const work = makeWork({ parts: [{ brand: 'Bosch', number: '0 986 4' }] });
    expect(sourcedParts(work, pages)).toEqual([
      { brand: 'Bosch', number: '0 986 4', slug: null },
    ]);
  });

  it('does not link the same number under another brand', () => {
    const work = makeWork({ parts: [{ brand: 'Bosch', number: 'HU816X' }] });
    expect(sourcedParts(work, pages)[0].slug).toBeNull();
  });

  it('renders every Part as text when the catalogue is missing', () => {
    const work = makeWork({ parts: [{ brand: 'Bosch', number: '1' }] });
    expect(sourcedParts(work, [])).toEqual([
      { brand: 'Bosch', number: '1', slug: null },
    ]);
  });
});

describe('sourcingWorks', () => {
  it('lists the published Works that sourced a Part page', () => {
    const page = partPage('MANN-FILTER', 'HU 816 x', 'HU816X');
    const sourced = makeWork({
      parts: [{ brand: 'mann-filter', number: 'HU816X' }],
    });
    const hidden = makeWork({
      published: false,
      parts: [{ brand: 'mann-filter', number: 'HU816X' }],
    });
    const other = makeWork({ parts: [{ brand: 'Bosch', number: 'HU816X' }] });
    expect(sourcingWorks([other, hidden, sourced], page)).toEqual([sourced]);
  });
});

describe('workPrice', () => {
  it('shows the RSD price on a Parts sourcing Work', () => {
    const work = makeWork({
      servicesApplied: ['vin-parts-inquiry'],
      priceRsd: 12500,
    });
    expect(workPrice(work)).toBe(12500);
  });

  it('hides the price on any other Work', () => {
    const work = makeWork({ servicesApplied: ['servicing'], priceRsd: 12500 });
    expect(workPrice(work)).toBeNull();
  });

  it('has no price when none is set', () => {
    expect(
      workPrice(makeWork({ servicesApplied: ['vin-parts-inquiry'] })),
    ).toBeNull();
  });
});
