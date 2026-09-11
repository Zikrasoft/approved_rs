import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createSectionLoader } from './loadSection.ts';

const loadSection = createSectionLoader({
  locales: ['ru', 'en', 'sr', 'de'] as const,
  defaultLocale: 'ru',
});

const schema = z.object({
  title: z.string(),
  cta: z.string(),
});

const yaml = `
title: Автоподбор
cta: Оставить заявку
translations:
  en:
    title: Vehicle sourcing
    cta: Request a call
  sr:
    title: Izbor vozila
    cta: Pošaljite zahtev
`;

describe('loadSection', () => {
  it('returns the source language as written', () => {
    const get = loadSection(schema, yaml);

    expect(get('ru')).toEqual({
      title: 'Автоподбор',
      cta: 'Оставить заявку',
    });
  });

  it('returns a translation when one exists', () => {
    const get = loadSection(schema, yaml);

    expect(get('en').title).toBe('Vehicle sourcing');
  });

  it('falls back to the source language for a locale with no translation', () => {
    const get = loadSection(schema, yaml);

    expect(get('de')).toEqual(get('ru'));
  });

  it('falls back for a translation that does not match the schema, keeping the rest of the site up', () => {
    const get = loadSection(
      schema,
      `
title: Автоподбор
cta: Оставить заявку
translations:
  en:
    title: Vehicle sourcing
`,
    );

    expect(get('en')).toEqual(get('ru'));
  });

  it('handles a file with no translations block at all', () => {
    const get = loadSection(schema, 'title: Только RU\ncta: Заявка\n');

    expect(get('en').title).toBe('Только RU');
  });

  it('throws at load time when the source language itself is invalid', () => {
    expect(() => loadSection(schema, 'title: Есть\n')).toThrow();
  });

  it('ignores keys the schema does not declare', () => {
    const get = loadSection(
      schema,
      'title: T\ncta: C\ntranslatedFrom: abc123\n',
    );

    expect(get('ru')).toEqual({ title: 'T', cta: 'C' });
  });

  it('does not resolve inherited object properties as translations', () => {
    const get = loadSection(schema, yaml);

    expect(get('constructor' as 'en')).toEqual(get('ru'));
  });
});
