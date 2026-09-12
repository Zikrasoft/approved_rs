import { describe, it, expect } from 'vitest';
import { localizedWork, publishedWorks, type Work } from './works';

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
    });
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
