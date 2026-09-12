import { describe, it, expect } from 'vitest';
import { stringify } from 'yaml';
import { z } from 'zod';
import { loadI18nSection } from './loadI18nSection';

const fixtureSchema = z
  .object({
    greeting: z.string(),
    farewell: z.string(),
  })
  .strict();

describe('loadI18nSection', () => {
  it('returns ru for the default locale', () => {
    const get = loadI18nSection(
      fixtureSchema,
      stringify({ greeting: 'Привет', farewell: 'Пока', translations: {} }),
    );
    expect(get('ru')).toEqual({ greeting: 'Привет', farewell: 'Пока' });
  });

  it('returns the stored translation for a locale that has one', () => {
    const get = loadI18nSection(
      fixtureSchema,
      stringify({
        greeting: 'Привет',
        farewell: 'Пока',
        translations: { en: { greeting: 'Hello', farewell: 'Bye' } },
      }),
    );
    expect(get('en')).toEqual({ greeting: 'Hello', farewell: 'Bye' });
  });

  it('falls back to ru for a locale with no stored translation', () => {
    const get = loadI18nSection(
      fixtureSchema,
      stringify({ greeting: 'Привет', farewell: 'Пока', translations: {} }),
    );
    expect(get('en')).toEqual({ greeting: 'Привет', farewell: 'Пока' });
  });

  it('falls back to ru for a locale whose stored translation fails schema validation', () => {
    const get = loadI18nSection(
      fixtureSchema,
      stringify({
        greeting: 'Привет',
        farewell: 'Пока',
        // "farewell" missing — fails the strict schema.
        translations: { en: { greeting: 'Hello' } },
      }),
    );
    expect(get('en')).toEqual({ greeting: 'Привет', farewell: 'Пока' });
  });

  it('throws if ru itself fails schema validation', () => {
    expect(() =>
      loadI18nSection(fixtureSchema, stringify({ greeting: 'Привет' })),
    ).toThrow();
  });
});
