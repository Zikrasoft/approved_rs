import { describe, it, expect } from 'vitest';
import {
  localizedWork,
  publishedWorks,
  relatedWorks,
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

describe('relatedWorks', () => {
  const brakes = makeWork({ servicesApplied: ['brakes-suspension'] });
  const gearbox = {
    ...makeWork({ servicesApplied: ['engine-gearbox'] }),
    id: 'dsg',
  } as Work;
  const alsoBrakes = {
    ...makeWork({ servicesApplied: ['brakes-suspension', 'servicing'] }),
    id: 'discs',
  } as Work;
  const servicing = {
    ...makeWork({ servicesApplied: ['servicing'] }),
    id: 'oil',
  } as Work;

  it('puts works sharing a service first', () => {
    const result = relatedWorks(
      [brakes, gearbox, alsoBrakes, servicing],
      brakes,
    );
    expect(result[0]!.id).toBe('discs');
  });

  it('never returns the work itself', () => {
    const result = relatedWorks(
      [brakes, gearbox, alsoBrakes, servicing],
      brakes,
    );
    expect(result.map((w) => w.id)).not.toContain('bmw-x5');
  });

  it('fills the remaining slots with the rest', () => {
    const result = relatedWorks(
      [brakes, gearbox, alsoBrakes, servicing],
      brakes,
    );
    expect(result.map((w) => w.id)).toEqual(['discs', 'dsg', 'oil']);
  });

  it('falls back to the rest when nothing shares a service', () => {
    const orphan = {
      ...makeWork({ servicesApplied: ['bodywork-painting'] }),
      id: 'body',
    } as Work;
    expect(
      relatedWorks([orphan, gearbox, servicing], orphan).map((w) => w.id),
    ).toEqual(['dsg', 'oil']);
  });

  it('honours the limit', () => {
    expect(
      relatedWorks([brakes, gearbox, alsoBrakes, servicing], brakes, 1),
    ).toHaveLength(1);
  });

  it('returns nothing when there is only one work', () => {
    expect(relatedWorks([brakes], brakes)).toEqual([]);
  });
});
