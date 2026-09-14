import { describe, it, expect } from 'vitest';
import { localizedWork, publishedWorks, workExcerpt, type Work } from './works';

function makeWork(
  overrides: Partial<Work['data']> = {},
  body = 'RU body',
): Work {
  return {
    id: 'bmw-x5',
    body,
    data: {
      title: 'BMW X5 в плёнке',
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
      title: 'BMW X5 в плёнке',
      body: 'RU body',
      car: 'BMW X5',
    });
  });

  it('returns the translation when one exists', () => {
    const work = makeWork({
      translations: { en: { title: 'BMW X5 wrapped', body: 'EN body' } },
    });
    expect(localizedWork(work, 'en')).toEqual({
      title: 'BMW X5 wrapped',
      body: 'EN body',
      car: 'BMW X5',
    });
  });

  it('falls back to ru when the locale has no translation at all', () => {
    expect(localizedWork(makeWork(), 'sr').title).toBe('BMW X5 в плёнке');
  });

  it('returns the translated car when the entry carries one', () => {
    const work = makeWork({
      car: 'Оклейка мотоциклов плёнкой',
      translations: {
        sr: { title: 'SR', body: 'SR body', car: 'Motocikli i ATV vozila' },
      },
    });
    expect(localizedWork(work, 'sr').car).toBe('Motocikli i ATV vozila');
  });

  it('falls back to the source car when the translation omits it', () => {
    const work = makeWork({
      translations: { sr: { title: 'SR', body: 'SR body' } },
    });
    expect(localizedWork(work, 'sr').car).toBe('BMW X5');
  });

  it('falls back to the source car when the whole translations block is absent', () => {
    expect(localizedWork(makeWork(), 'sr').car).toBe('BMW X5');
    expect(localizedWork(makeWork(), 'ru').car).toBe('BMW X5');
  });

  it('falls back to ru rather than rendering a half-written translation', () => {
    const work = makeWork({
      translations: { sr: { title: 'BMW X5 u foliji', body: '   ' } },
    });
    expect(localizedWork(work, 'sr')).toEqual({
      title: 'BMW X5 в плёнке',
      body: 'RU body',
      car: 'BMW X5',
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

describe('workExcerpt', () => {
  it('strips markdown and html and joins paragraphs into sentences', () => {
    const body =
      '## Заголовок без точки\n\nТекст с **жирным** и <ul class="x"><li>пунктом</li></ul>';
    expect(workExcerpt(body)).toBe(
      'Заголовок без точки. Текст с жирным и пунктом',
    );
  });

  it('keeps a short body whole', () => {
    expect(workExcerpt('Коротко.')).toBe('Коротко.');
  });

  it('cuts at the last sentence that still fills the description', () => {
    const body = `${'а'.repeat(120)}. ${'б'.repeat(120)}.`;
    expect(workExcerpt(body)).toBe(`${'а'.repeat(120)}.`);
  });

  it('falls back to a word boundary when no sentence ends in range', () => {
    const body = `${'слово '.repeat(60)}конец.`;
    const excerpt = workExcerpt(body);
    expect(excerpt.length).toBeLessThanOrEqual(159);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt.endsWith(' …')).toBe(false);
  });
});

describe('workExcerpt edge cases', () => {
  it('rejects a sentence break too early to fill the description', () => {
    const body = `Кратко. ${'слово '.repeat(40)}конец.`;
    const excerpt = workExcerpt(body);

    expect(excerpt).not.toBe('Кратко.');
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('keeps the link text and drops the url', () => {
    expect(
      workExcerpt('Смотрите [наши работы](https://details.rs/works/) тут'),
    ).toBe('Смотрите наши работы тут');
  });
});
